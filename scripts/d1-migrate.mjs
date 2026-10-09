// Controlled, private data migration. Only aggregate counts are written to stdout.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, closeSync, writeSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sqliteDatabase } from '../src/storage/sqlite.mjs';
import { backupDatabase } from '../src/security/backup.mjs';
const tables=['members','ai_credit_accounts','ai_credit_events','ai_conversations','ai_questions','sessions','line_oauth_flows',
  'monthly_codes','renewal_requests','membership_events','admin_credit_grants','customer_preferences','customer_favorites','customer_holdings','customer_daily_reports',
  'auto_pick_runs','auto_pick_signals','auto_pick_events','auto_pick_decisions','auto_pick_scan_progress','auto_pick_worker_heartbeat',
  'scanner_candles','historical_replay_summaries','request_limits','scanner_jobs','provider_cache','cloud_scanner_state'];
const directory=resolve(process.env.D1_MIGRATION_DIR||'data/d1-migration');
const quoteName=value=>'"'+value.replaceAll('"','""')+'"';
function literal(value) {
  if(value===null)return 'NULL';
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('NON_FINITE_VALUE');return String(value);}
  if(typeof value==='bigint')return value.toString();
  if(typeof value!=='string')throw new Error('UNSUPPORTED_VALUE');
  return value.includes('\0')?`CAST(X'${Buffer.from(value).toString('hex')}' AS TEXT)`:`'${value.replaceAll("'","''")}'`;
}
function tableManifest(db,name) {
  const columns=db.prepare(`PRAGMA table_info(${quoteName(name)})`).all();
  if(!columns.length)throw new Error('MISSING_TABLE:'+name);
  const fields=columns.map(row=>row.name).sort();
  const key=columns.filter(row=>row.pk).sort((a,b)=>a.pk-b.pk).map(row=>row.name);
  if(!key.length)throw new Error('TABLE_WITHOUT_PRIMARY_KEY:'+name);
  const hash=createHash('sha256');let count=0;
  for(const row of db.prepare(`SELECT ${fields.map(quoteName).join(',')} FROM ${quoteName(name)} ORDER BY ${key.map(quoteName).join(',')}`).iterate()) {
    hash.update(JSON.stringify(fields.map(field=>row[field]))+'\n');count++;
  }
  return {columns:fields,count,sha256:hash.digest('hex')};
}
function manifest(db) {return Object.fromEntries(tables.map(name=>[name,tableManifest(db,name)]));}
function same(a,b) { return tables.every(name=>a[name].count===b[name].count&&a[name].sha256===b[name].sha256&&JSON.stringify(a[name].columns)===JSON.stringify(b[name].columns)); }
function wrangler(args) {
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  // Import/export logs can include SQL on failure. Never echo that output with customer data.
  if(result.status!==0)throw new Error('D1_COMMAND_FAILED: inspect protected Cloudflare logs locally');
  return result.stdout;
}
function prepare() {
  if(existsSync(join(directory,'snapshot.sqlite')))throw new Error('SNAPSHOT_EXISTS: choose a new private D1_MIGRATION_DIR');
  const source=sqliteDatabase();
  if(source.prepare("SELECT COUNT(*) AS n FROM ai_questions WHERE status='pending'").get().n)throw new Error('AI_REQUESTS_IN_PROGRESS: wait for answers before taking the snapshot');
  const backup=backupDatabase();
  mkdirSync(directory,{recursive:true,mode:0o700});
  source.exec(`VACUUM INTO ${literal(join(directory,'snapshot.sqlite'))}`);chmodSync(join(directory,'snapshot.sqlite'),0o600);
  const snapshot=new DatabaseSync(join(directory,'snapshot.sqlite'),{readOnly:true});
  const report={createdAt:new Date().toISOString(),encryptedBackup:backup,tables:manifest(snapshot)};
  const fd=openSync(join(directory,'import.sql'),'wx',0o600);
  try {
    writeSync(fd,'PRAGMA defer_foreign_keys=ON;\n');
    for(const name of tables) {
      const columns=report.tables[name].columns;
      const prefix=`INSERT INTO ${quoteName(name)} (${columns.map(quoteName).join(',')}) VALUES `;
      let rows=[],bytes=Buffer.byteLength(prefix);
      const flush=()=>{if(rows.length)writeSync(fd,prefix+rows.join(',')+';\n');rows=[];bytes=Buffer.byteLength(prefix);};
      for(const row of snapshot.prepare(`SELECT * FROM ${quoteName(name)}`).iterate()) {
        const text='('+columns.map(field=>literal(row[field])).join(',')+')';
        if(Buffer.byteLength(text)+Buffer.byteLength(prefix)>90000)throw new Error('D1_ROW_TOO_LARGE:'+name);
        if(bytes+Buffer.byteLength(text)>64000||rows.length>=50)flush();
        rows.push(text);bytes+=Buffer.byteLength(text)+1;
      }
      flush();
    }
  }finally{closeSync(fd);snapshot.close();}
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({snapshot:directory,backup,counts:Object.fromEntries(tables.map(name=>[name,report.tables[name].count]))}));
}
async function importAndVerify(configPath,local) {
  if(!configPath)throw new Error('D1_CONFIG_REQUIRED');
  const report=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
  // The free allowance also counts index writes. Do not start a large import
  // that can strand a half-migrated customer database on a free account.
  const rowCount=Object.values(report.tables).reduce((sum,table)=>sum+table.count,0);
  if(!local&&rowCount>25000&&process.env.D1_PAID_PLAN_CONFIRMED!=='true')throw new Error('PAID_PLAN_REQUIRED_FOR_LARGE_IMPORT: confirm billing before transferring the snapshot');
  const {getPlatformProxy}=await import('wrangler');
  const target=await getPlatformProxy({configPath,remoteBindings:!local,persist:{path:resolve(dirname(configPath),'.wrangler/state/v3')}});
  try {
    for(const name of tables) {
      const row=await target.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${quoteName(name)}`).first();
      if(row.n)throw new Error('DESTINATION_NOT_EMPTY:'+name);
    }
  }finally{await target.dispose();}
  const flags=['--config',configPath,local?'--local':'--remote'];
  wrangler(['d1','execute','DB',...flags,'--file',join(directory,'import.sql'),'--yes']);
  await verify(configPath,local,report);
}
async function verify(configPath,local,report=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'))) {
  if(!configPath)throw new Error('D1_CONFIG_REQUIRED');
  const flags=['--config',configPath,local?'--local':'--remote'];
  const exportPath=join(directory,'d1-export.sql');
  wrangler(['d1','export','DB',...flags,'--output',exportPath,'--skip-confirmation']);chmodSync(exportPath,0o600);
  const recoveredPath=join(directory,'d1-recovered.sqlite');
  if(existsSync(recoveredPath))throw new Error('VERIFICATION_FILE_EXISTS: preserve it and use a new private verification directory');
  const recovered=new DatabaseSync(recoveredPath);chmodSync(recoveredPath,0o600);
  try {
    // Wrangler exports tables alphabetically, including child records before their parents.
    // Disable enforcement only in this private comparison file and check every FK afterwards.
    recovered.exec('PRAGMA foreign_keys=OFF; BEGIN');
    recovered.exec(readFileSync(exportPath,'utf8'));
    recovered.exec('COMMIT');
    if(recovered.prepare('PRAGMA foreign_key_check').all().length)throw new Error('D1_FOREIGN_KEY_MISMATCH');
    if(recovered.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('D1_INTEGRITY_FAILED');
    const actual=manifest(recovered);
    if(!same(report.tables,actual))throw new Error('D1_SNAPSHOT_MISMATCH: do not switch the application');
    writeFileSync(join(directory,'verified.json'),JSON.stringify({verifiedAt:new Date().toISOString(),configPath,local,tables:actual},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({status:'verified',local,counts:Object.fromEntries(tables.map(name=>[name,actual[name].count]))}));
  }finally{recovered.close();}
}
function unchanged() {
  const expected=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')).tables;
  if(!same(expected,manifest(sqliteDatabase())))throw new Error('SOURCE_CHANGED: freeze writers and take a fresh snapshot before switching');
  console.log('Source matches the verified snapshot. Cutover is safe while writers remain paused.');
}
const [action,...args]=process.argv.slice(2);
process.umask(0o077);
try {
  if(action==='prepare')prepare();
  else if(action==='import')await importAndVerify(args[0],args.includes('--local'));
  else if(action==='verify')await verify(args[0],args.includes('--local'));
  else if(action==='unchanged')unchanged();
  else throw new Error('Usage: d1-migrate.mjs prepare | import CONFIG [--local] | verify CONFIG [--local] | unchanged');
}catch(error){console.error(error.message);process.exitCode=1;}
