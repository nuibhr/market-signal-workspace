import {createHash,randomUUID} from 'node:crypto';
import {storage} from '../storage/database.mjs';
import {autoPickReadiness,thaiScanSymbols,drScanSymbols,usScanSymbols,runThaiAutoPick,runDrAutoPick,runUsAutoPick} from './runner.mjs';
import {activeSignals,scanCoverage,heartbeatWorker,reconcileWatchPlans,claimRun,finishRun} from './store.mjs';
import {thaiSession} from './engine.mjs';
import {drSession} from './dr-orb.mjs';
import {usEodSession} from '../market-data/fmp-us.mjs';
import {usScanSlot} from '../markets/us-universe.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const LEASE_MS=180000,BATCH_SIZE=4;
export function marketWindow(market,now){
  if(market==='thai'){const s=thaiSession(now);return {key:s.day,monitor:s.monitorWindow,candidate:s.candidateWindow,symbols:thaiScanSymbols()};}
  if(market==='dr'){const s=drSession(now);return {key:s.key,monitor:s.monitorWindow,candidate:s.candidateWindow,symbols:drScanSymbols()};}
  const s=usEodSession(now);return {key:usScanSlot(s.day),monitor:s.scanWindow,candidate:s.scanWindow,symbols:usScanSymbols()};
}
export function createCloudScanner({readiness=autoPickReadiness,windowFor=marketWindow,runMarket=({thai:runThaiAutoPick,dr:runDrAutoPick,us:runUsAutoPick})}={}){
async function finishUsCoverage(now){
  const s=usEodSession(now);if(!s.scanWindow)return;
  const c=await scanCoverage('us',usScanSlot(s.day),usScanSymbols(),now);
  if(c.remaining)return;
  const id=await claimRun('us',usScanSlot(s.day),{retryFailed:true});
  if(id)await finishRun(id,{scanned:c.done,errorCode:c.unavailable?'PARTIAL_SOURCE_UNAVAILABLE':null});
}
async function scheduleScans(queue,now=Date.now(),cron='*/5 * * * *'){
  if(!queue?.sendBatch)throw Error('SCANNER_QUEUE_REQUIRED');
  await heartbeatWorker();
  const enabled=readiness().markets.filter(m=>m.status==='active').map(m=>m.id);
  await reconcileWatchPlans(enabled);
  const bucket=new Date(Math.floor(now/300000)*300000).toISOString();
  // Expired jobs must not occupy the queue ahead of today's monitoring work.
  const windows=new Map();
  for(const market of ['thai','dr','us']){
    const window=windowFor(market,now);windows.set(market,window);
    await storage.run(`UPDATE scanner_jobs SET state='cancelled',error_code='SESSION_ENDED',lease_token=NULL,lease_until=NULL,updated_at=?
      WHERE market=? AND state IN ('pending','retry','running') AND (session_key<>? OR ?=0)`,
      new Date(now).toISOString(),market,window.key,enabled.includes(market)&&window.monitor?1:0);
  }
  for(const market of enabled){
    const window=windows.get(market);if(!window.monitor)continue;
    const active=await activeSignals(market);
    const candidates=window.candidate?(await scanCoverage(market,window.key,window.symbols,now)).pending:[];
    const outstanding=await storage.all(`SELECT payload_json FROM scanner_jobs WHERE market=? AND session_key=? AND state IN ('pending','retry','running')`,market,window.key);
    const busy=new Set(outstanding.flatMap(job=>JSON.parse(job.payload_json).symbols));
    // Coalesce a slow batch across Cron ticks: one outstanding task per symbol.
    // Once it finishes, an active trade can get a new monitoring task next tick.
    const monitored=new Set(active.map(p=>p.symbol));
    const groups=[{priority:0,symbols:[...monitored].filter(s=>!busy.has(s))},
      {priority:1,symbols:[...new Set(candidates)].filter(s=>!busy.has(s)&&!monitored.has(s))}];
    for(const {priority,symbols} of groups)for(let i=0;i<symbols.length;i+=BATCH_SIZE){
      const part=symbols.slice(i,i+BATCH_SIZE),id=hash(`${market}:${window.key}:${bucket}:${part.join(',')}`);
      const at=new Date(now).toISOString(),payload=JSON.stringify({symbols:part});
      await storage.run(`INSERT OR IGNORE INTO scanner_jobs(id,market,session_key,slot,payload_json,available_at,created_at,updated_at,priority) VALUES(?,?,?,?,?,?,?,?,?)`,id,market,window.key,bucket,payload,now,at,at,priority);
    }
    // Promote an existing candidate task if its symbol has since entered a trade.
    for(const symbol of monitored)await storage.run(`UPDATE scanner_jobs SET priority=0 WHERE market=? AND session_key=?
      AND priority=1 AND state IN ('pending','retry','running') AND EXISTS(SELECT 1 FROM json_each(payload_json,'$.symbols') WHERE value=?)`,market,window.key,symbol);
  }
  // A sent-but-unacknowledged task is safe to send again. Consumers claim it atomically.
  const due=await storage.all(`SELECT id FROM scanner_jobs WHERE
    ((state IN ('pending','retry') AND available_at<=?) OR (state='running' AND lease_until<?))
    AND (last_enqueued_at IS NULL OR last_enqueued_at<?) ORDER BY priority,created_at,id LIMIT 100`,now,now,now-300000);
  let dispatched=0;
  for(const row of due){
    const claimed=await storage.first(`UPDATE scanner_jobs SET last_enqueued_at=? WHERE id=?
      AND (last_enqueued_at IS NULL OR last_enqueued_at<?) RETURNING id`,now,row.id,now-300000);
    if(!claimed)continue;
    try{await queue.sendBatch([{body:{id:row.id}}]);dispatched++;}
    catch{await storage.run('UPDATE scanner_jobs SET last_enqueued_at=NULL,error_code=? WHERE id=? AND last_enqueued_at=?','QUEUE_SEND_UNAVAILABLE',row.id,now);throw Error('QUEUE_SEND_UNAVAILABLE');}
  }
  if(enabled.includes('us'))await finishUsCoverage(now);
  await storage.run(`INSERT INTO cloud_scanner_state(id,last_scheduled_at,cron,dispatch_count) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET last_scheduled_at=excluded.last_scheduled_at,cron=excluded.cron,dispatch_count=excluded.dispatch_count`,new Date(now).toISOString(),cron,dispatched);
  // Expired response caches are optional; removing them never touches recorded trades.
  await storage.run('DELETE FROM provider_cache WHERE id IN (SELECT id FROM provider_cache WHERE expires_at<? LIMIT 100)',now-86400000);
  await storage.run(`DELETE FROM scanner_jobs WHERE id IN (SELECT id FROM scanner_jobs WHERE state IN ('done','cancelled','failed') AND updated_at<? LIMIT 100)`,new Date(now-7*86400000).toISOString());
  return {dispatched};
}
async function consumeScan(id,now=Date.now()){
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('INVALID_SCANNER_JOB');
  const token=randomUUID(),row=await storage.first(`UPDATE scanner_jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=?
    WHERE id=? AND ((state IN ('pending','retry') AND available_at<=?) OR (state='running' AND lease_until<?)) RETURNING *`,token,now+LEASE_MS,new Date(now).toISOString(),id,now,now);
  if(!row){const current=await storage.first('SELECT state FROM scanner_jobs WHERE id=?',id);return {status:current?.state==='running'?'busy':'ignored'};}
  const mark=(state,code=null,delay=0)=>storage.run(`UPDATE scanner_jobs SET state=?,error_code=?,available_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?`,state,code,now+delay,new Date(now).toISOString(),id,token);
  try{
    const window=windowFor(row.market,now),payload=JSON.parse(row.payload_json);
    if(!readiness().markets.some(m=>m.id===row.market&&m.status==='active')||!window.monitor||window.key!==row.session_key){await mark('cancelled','SESSION_ENDED');return {status:'cancelled'};}
    if(!Array.isArray(payload.symbols)||!payload.symbols.length||payload.symbols.length>BATCH_SIZE||payload.symbols.some(symbol=>!window.symbols.includes(symbol)))throw Error('INVALID_SCANNER_JOB');
    const run=runMarket[row.market];
    const result=await run(now,{id:`cloud:${row.id}`,symbols:payload.symbols,budgetMs:90000});
    if(result.status==='already-run'){
      // A previous consumer wrote its final run state before losing its acknowledgement.
      const finished=await storage.first('SELECT status FROM auto_pick_runs WHERE market=? AND slot=?',row.market,`cloud:${row.id}`);
      if(finished?.status!=='COMPLETE')throw Error('RUN_NOT_FINISHED');
    }
    if(result.status==='unavailable'||result.status==='waiting-eod'||result.errors?.some(e=>e.includes('RETRY')||e.includes('MONITOR')||row.market==='us'&&!e.includes('PLAN_REQUIRED')))throw Error(result.code||'SOURCE_RETRY');
    await mark('done',result.errors?.length?'PARTIAL_SOURCE_UNAVAILABLE':null);
    await heartbeatWorker();
    await storage.run('UPDATE cloud_scanner_state SET last_consumed_at=? WHERE id=1',new Date().toISOString());
    if(row.market==='us')await finishUsCoverage(Date.now());
    return {status:'done'};
  }catch(error){
    const terminal=error.message==='INVALID_SCANNER_JOB';
    const delay=Math.min(300000,60000*2**Math.min(3,row.attempts-1));
    await mark(terminal?'failed':'retry',terminal?'INVALID_SCANNER_JOB':'SOURCE_RETRY',delay);
    return {status:terminal?'failed':'retry',delaySeconds:Math.ceil(delay/1000)};
  }
}

return {scheduleScans,consumeScan};
}
export const {scheduleScans,consumeScan}=createCloudScanner();
