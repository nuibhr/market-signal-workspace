import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'nugaom-coverage-'));
process.env.DATABASE_PATH=join(dir,'fixture.sqlite');process.env.AUTO_PICK_RUN_SECRET='fixture-worker-'.repeat(4);
const {storage,withD1Database}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {claimRun,createSignal,recordScanProgress,scanCoverage,settleScanCoverage,workerProcessHealth,heartbeatWorker}=await import('./store.mjs');
const {coveragePhase,scanWindowBounds,MAX_SOURCE_FAILURES}=await import('./coverage-policy.mjs');
const {summarizeCoverage}=await import('./coverage-view.mjs');
const {createAutoPickRunners,thaiScanSymbols,drScanSymbols,usScanSymbols}=await import('./runner.mjs');
const {usScanSlot}=await import('../markets/us-universe.mjs');
const {createLocalScanScheduler}=await import('./local-scheduler.mjs');
const {SCANNER_RUNTIME_VERSION}=await import('./runtime-version.mjs');
const at=s=>Date.parse(`2026-10-14T${s}:00+07:00`);
const ready=()=>({markets:['thai','dr','us'].map(id=>({id,status:'active'}))});
function daily(day='2026-10-13') {const bars=[];for(let index=449;index>=0;index--){const date=new Date(Date.parse(`${day}T12:00:00Z`)-index*86400000);if([0,6].includes(date.getUTCDay()))continue;bars.push({time:date.toISOString().slice(0,10),open:10,high:10.1,low:9.9,close:10,volume:100});}return bars.slice(-250);}
function fixtureSource(t,{failSymbol=null,crossCutoff=false}={}) {
  const failures={};
  return {failures,async login(){},async getQuote(){t.mock.timers.tick(100);return {status:'available',marketStatus:'day'};},async getCandles(symbol,timeframe){
    t.mock.timers.tick(crossCutoff?40000:100);
    if(symbol===failSymbol){failures[symbol]=(failures[symbol]||0)+1;throw Object.assign(Error('SOURCE_UNAVAILABLE'),{code:'SOURCE_UNAVAILABLE',status:503});}
    return {source:'FIXTURE ONLY',bars:timeframe==='1d'?daily():Array.from({length:40},(_,i)=>({time:Math.floor(Date.now()/900000)*900-40*900+i*900,open:10,high:10.1,low:9.9,close:10,volume:100}))};
  }};
}
test('fresh symbols precede retries, source retries back off and terminate after five failures',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('10:30')});
  await recordScanProgress('thai','2026-10-14','RETRY','retry','SOURCE_HTTP_503');t.mock.timers.tick(61001);
  assert.deepEqual((await scanCoverage('thai','2026-10-14',['RETRY','NEW'])).pending,['NEW','RETRY']);
  await recordScanProgress('thai','2026-10-14','RETRY','retry','SOURCE_HTTP_503');t.mock.timers.tick(61001);
  assert.deepEqual((await scanCoverage('thai','2026-10-14',['RETRY'])).pending,[]);
  for(let index=2;index<MAX_SOURCE_FAILURES;index++){t.mock.timers.tick(300001);await recordScanProgress('thai','2026-10-14','RETRY','retry','SOURCE_HTTP_503');}
  const coverage=await scanCoverage('thai','2026-10-14',['RETRY']);assert.equal(coverage.unavailable,1);assert.equal(coverage.remaining,0);assert.equal(coverage.pending.length,0);
  assert.match(coverage.unavailableSymbols[0].reason,/SOURCE_RETRY_EXHAUSTED/);
});
async function verifyCutoff(){
  const key='2026-10-14';
  await recordScanProgress('thai',key,'DONE','done');await recordScanProgress('thai',key,'WAIT','retry','OPENING_BAR_UNAVAILABLE');await recordScanProgress('thai',key,'FAIL','retry','SOURCE_HTTP_503');
  const before=await scanCoverage('thai',key,['DONE','WAIT','FAIL','NEW'],at('10:45'));assert.equal(before.remaining,3);assert.equal(before.neverChecked,1);
  const after=await settleScanCoverage('thai',key,['DONE','WAIT','FAIL','NEW'],at('11:15'));
  assert.deepEqual([after.done,after.ineligible,after.unavailable,after.missed,after.remaining],[1,1,1,1,0]);
  const missed=await storage.first('SELECT attempts FROM auto_pick_scan_progress WHERE market=? AND session_key=? AND symbol=?','thai',key,'NEW');assert.equal(missed.attempts,0);
  assert.match(summarizeCoverage(after).label,/พลาดตรวจ/);assert.equal(summarizeCoverage(after).evaluated,1);
  await settleScanCoverage('thai',key,['DONE','WAIT','FAIL','NEW'],at('12:00'));assert.equal((await storage.first('SELECT attempts FROM auto_pick_scan_progress WHERE market=? AND session_key=? AND symbol=?','thai',key,'WAIT')).attempts,1,'Cutoff is not another source attempt');
}
test('cutoff closes all statuses without inventing a completed evaluation',verifyCutoff);
test('market windows include DR night and US catch-up across DST',()=>{
  assert.equal(coveragePhase('dr','2026-10-14:night',at('21:29')),'active');assert.equal(coveragePhase('dr','2026-10-14:night',at('21:30')),'ended');
  assert.equal(scanWindowBounds('us','2026-10-13:fixture').end,Date.parse('2026-10-14T12:00:00Z'));
  assert.equal(scanWindowBounds('us','2026-11-03:fixture').end,Date.parse('2026-11-04T13:00:00Z'));
  assert.equal(scanWindowBounds('us','2026-10-16:fixture').end,Date.parse('2026-10-19T12:00:00Z'),'Friday catch-up stays eligible until Monday before the open');
  assert.equal(coveragePhase('us','2026-10-16:fixture',Date.parse('2026-10-18T16:00:00Z')),'paused');
  assert.equal(coveragePhase('us','2026-10-16:fixture',Date.parse('2026-10-19T11:30:00Z')),'active');
  assert.equal(coveragePhase('thai','2026-10-14',at('09:00')),'waiting');
});
test('bounded Thai and DR batches eventually evaluate their full current rosters',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('10:30')});
  const source=fixtureSource(t),runners=createAutoPickRunners({source,readiness:ready});
  for(const [market,run,symbols,key] of [['thai',runners.runThaiAutoPick,thaiScanSymbols(),'2026-10-14'],['dr',runners.runDrAutoPick,drScanSymbols(),'2026-10-14:day']]) {
    // Use an untouched day so this fixture is independent of the cutoff test.
    await storage.run('DELETE FROM auto_pick_scan_progress WHERE market=? AND session_key=?',market,key);
    let result;
    for(let round=0;round<8;round++){result=await run();if(result.coverage?.remaining===0)break;t.mock.timers.tick(61001);}
    const coverage=await scanCoverage(market,key,symbols);
    assert.equal(coverage.done,symbols.length);assert.equal(coverage.remaining,0);assert.equal(coverage.missed,0);assert.equal(result.status,'complete');
    assert.equal((await storage.first('SELECT COUNT(*) AS n FROM auto_pick_signals WHERE market=?',market)).n,0,'Low-value fixture bars do not fabricate signals');
  }
});
test('US finishes 500 statuses with missing bars explicit and does not re-fetch a settled session',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('05:30')});
  let unavailableCalls=0,calls=0;
  const runners=createAutoPickRunners({readiness:ready,usSource:async symbol=>{calls++;t.mock.timers.tick(100);if(symbol==='WBD'){unavailableCalls++;throw Object.assign(Error('BARS_UNAVAILABLE'),{code:'BARS_UNAVAILABLE'});}return {source:'FIXTURE ONLY',latestDay:'2026-10-13',bars:daily()};}});
  let result;for(let round=0;round<8;round++){result=await runners.runUsAutoPick();if(result.coverage?.remaining===0)break;t.mock.timers.tick(61001);}
  assert.equal(result.coverage.expected,500);assert.equal(result.coverage.done,499);assert.equal(result.coverage.unavailable,1);assert.equal(result.coverage.remaining,0);assert.equal(unavailableCalls,1);
  const previous=calls;assert.equal((await runners.runUsAutoPick()).status,'already-run');assert.equal(calls,previous);
  assert.equal((await scanCoverage('us',usScanSlot('2026-10-13'),usScanSymbols())).pending.length,0);
});
test('US waiting plans do not reload the same reference day, but monitoring resumes on a new daily close',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('05:30')});
  await createSignal({market:'us',symbol:'NVDA',sessionDay:'2026-10-13',source:'FIXTURE ONLY',plan:{id:'same-day-fixture',tradeAllowed:true,timeframe:'1d',entry:100,stopLoss:98,tp1:104,maxEntryBars:1,referenceCandles:{dailyDay:'2026-10-13'}}});
  const calls=[];let day='2026-10-13';
  const runners=createAutoPickRunners({readiness:ready,usSource:async symbol=>{calls.push(symbol);return {source:'FIXTURE ONLY',latestDay:day,bars:daily(day)};}});
  const current=await runners.runUsAutoPick(Date.now(),{id:'current-close-monitor',symbols:['NVDA']});
  assert.deepEqual(calls,['AAPL']);assert.equal(current.monitored,0);
  calls.length=0;day='2026-10-14';t.mock.timers.setTime(Date.parse('2026-10-15T05:30:00+07:00'));
  const next=await runners.runUsAutoPick(Date.now(),{id:'next-close-monitor',symbols:['NVDA']});
  assert.ok(calls.includes('NVDA'));assert.equal(next.monitored,1);
});
test('US cloud run recovery uses the same three-minute lease as the queue consumer',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('05:30')});
  const slot='cloud:lost-us-consumer',id=await claimRun('us',slot);
  await storage.run('UPDATE auto_pick_runs SET started_at=? WHERE id=?',new Date(Date.now()-181000).toISOString(),id);
  const runners=createAutoPickRunners({readiness:ready,usSource:async()=>({source:'FIXTURE ONLY',latestDay:'2026-10-13',bars:daily()})});
  assert.equal((await runners.runUsAutoPick(Date.now(),{id:slot,symbols:['AAPL']})).status,'complete');
  assert.equal((await storage.first('SELECT status FROM auto_pick_runs WHERE id=?',id)).status,'COMPLETE');
});
test('a fetch crossing the Thai cutoff cannot publish a late new plan',async t=>{
  t.mock.timers.enable({apis:['Date'],now:at('11:14')});
  const source=fixtureSource(t,{crossCutoff:true}),runners=createAutoPickRunners({source,readiness:ready});
  const result=await runners.runThaiAutoPick(Date.now(),{id:'late-fixture',symbols:['LATE']});
  assert.equal(result.coverage.missed,1);assert.equal(result.candidates,0);
});
test('a slow US run cannot block Thai/DR dispatch or start overlapping runs',async()=>{
  let release;const delayed=new Promise(resolve=>{release=resolve;});const calls={thai:0,dr:0,us:0};
  const scheduler=createLocalScanScheduler({runners:Object.fromEntries(['thai','dr','us'].map(market=>[market,async()=>{calls[market]++;if(market==='us')await delayed;return {status:'complete'};}]))});
  scheduler.dispatch(['thai','dr','us']);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(scheduler.active(),['us']);assert.deepEqual(scheduler.dispatch(['thai','dr','us']),['thai','dr']);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,{thai:2,dr:2,us:1});release();await scheduler.drain();assert.deepEqual(scheduler.active(),[]);
});
test('heartbeat detects stale loaded worker code without losing the current version on unversioned probes',async()=>{
  await heartbeatWorker();assert.equal((await workerProcessHealth()).status,'stale');await heartbeatWorker({runtimeVersion:SCANNER_RUNTIME_VERSION});assert.equal((await workerProcessHealth()).status,'running');await heartbeatWorker();assert.equal((await workerProcessHealth()).runtimeVersion,SCANNER_RUNTIME_VERSION);
});
test('native D1 applies migration 0009 and the same explicit cutoff states',async()=>{
  const configPath=join(dir,'wrangler.json');writeFileSync(configPath,JSON.stringify({name:'coverage-fixture',compatibility_date:'2026-10-07',d1_databases:[{binding:'DB',database_name:'fixture',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:resolve('deploy/cloudflare/migrations')}]}));
  const applied=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config',configPath],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});assert.equal(applied.status,0);
  const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:join(dir,'.wrangler/state/v3')}});
  try{await withD1Database(proxy.env.DB,async()=>{await verifyCutoff();for(let index=0;index<5;index++)await recordScanProgress('us','2026-10-13:fixture','RETRY','retry','SOURCE_UNAVAILABLE');assert.equal((await scanCoverage('us','2026-10-13:fixture',['RETRY'])).unavailable,1);});}finally{await proxy.dispose();}
});
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
