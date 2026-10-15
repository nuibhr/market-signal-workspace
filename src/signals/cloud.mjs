import { randomUUID } from 'node:crypto';
import { storage } from '../storage/database.mjs';
import { autoPickReadiness } from '../auto-pick/runner.mjs';
import { signalUniverse, signalProviderAllowed } from './data.mjs';
import { activeReferenceSignals, observationSchedule } from './store.mjs';
import { signalId } from './model.mjs';
import { runSignalScan } from './runner.mjs';

export function createSignalCloud({readiness=autoPickReadiness,run=runSignalScan,allowed=signalProviderAllowed}={}){
 async function schedule(queue,now=Date.now()){
  if(!queue?.sendBatch)throw Error('SCANNER_QUEUE_REQUIRED');
  const markets=readiness().markets.filter(m=>m.status==='active'&&['thai','dr','us'].includes(m.id)&&allowed(m.id)).map(m=>m.id);
  await storage.run(`UPDATE scanner_jobs SET state='failed',error_code='JOB_EXPIRED',lease_token=NULL,lease_until=NULL WHERE json_extract(payload_json,'$.kind')='swing' AND state IN ('pending','retry','running') AND created_at<? AND (state<>'running' OR lease_until<?)`,new Date(now-1800000).toISOString(),now);
  for(const market of markets){
   const times=new Map((await observationSchedule(market)).map(r=>[r.symbol,r.next_scan_ms]));
   const outstanding=await storage.all(`SELECT payload_json FROM scanner_jobs WHERE market=? AND json_extract(payload_json,'$.kind')='swing' AND state IN ('pending','retry','running')`,market);
   const busy=new Set(outstanding.flatMap(r=>JSON.parse(r.payload_json).symbols));
   const active=new Set((await activeReferenceSignals(market)).map(s=>s.symbol));
   const due=signalUniverse(market).filter(a=>(times.get(a.symbol)??0)<=now&&!busy.has(a.symbol)).sort((a,b)=>(times.get(a.symbol)??0)-(times.get(b.symbol)??0));
   const work=[...active].filter(s=>!busy.has(s));
   work.push(...due.filter(a=>!active.has(a.symbol)).slice(0,60).map(a=>a.symbol));
   for(let i=0;i<work.length;i+=4){
    const symbols=work.slice(i,i+4),id=signalId(`swing:${market}:${Math.floor(now/300000)}:${symbols.join(',')}`),at=new Date(now).toISOString();
    await storage.run(`INSERT OR IGNORE INTO scanner_jobs(id,market,session_key,slot,payload_json,available_at,created_at,updated_at,priority) VALUES(?,?,?,?,?,?,?,?,?)`,id,market,'swing',at,JSON.stringify({kind:'swing',symbols}),now,at,at,symbols.some(s=>active.has(s))?0:1);
   }
  }
  const due=await storage.all(`SELECT id FROM scanner_jobs WHERE json_extract(payload_json,'$.kind')='swing' AND ((state IN ('pending','retry') AND available_at<=?) OR (state='running' AND lease_until<?)) AND (last_enqueued_at IS NULL OR last_enqueued_at<?) ORDER BY priority,created_at,id LIMIT 100`,now,now,now-300000);
  let dispatched=0;
  for(const row of due){
   const claimed=await storage.first(`UPDATE scanner_jobs SET last_enqueued_at=? WHERE id=? AND (last_enqueued_at IS NULL OR last_enqueued_at<?) RETURNING id`,now,row.id,now-300000);if(!claimed)continue;
   try{await queue.sendBatch([{body:{kind:'swing',id:row.id}}]);dispatched++;}
   catch{await storage.run('UPDATE scanner_jobs SET last_enqueued_at=NULL WHERE id=? AND last_enqueued_at=?',row.id,now);throw Error('QUEUE_SEND_UNAVAILABLE');}
  }
  return {dispatched};
 }
 async function consume(id,now=Date.now()){
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return {status:'ignored'};
  const token=randomUUID(),row=await storage.first(`UPDATE scanner_jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=? AND json_extract(payload_json,'$.kind')='swing' AND attempts<5 AND created_at>=? AND ((state IN ('pending','retry') AND available_at<=?) OR (state='running' AND lease_until<?)) RETURNING *`,token,now+180000,id,new Date(now-1800000).toISOString(),now,now);
  if(!row){const current=await storage.first('SELECT state FROM scanner_jobs WHERE id=?',id);return {status:current?.state==='running'?'busy':'ignored',delaySeconds:60};}
  const finish=(state,code=null,delay=0)=>storage.run(`UPDATE scanner_jobs SET state=?,error_code=?,available_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=?`,state,code,now+delay,new Date(now).toISOString(),id,token);
  try{
   const payload=JSON.parse(row.payload_json),known=new Set(signalUniverse(row.market).map(a=>a.symbol));
   if(!readiness().markets.some(m=>m.id===row.market&&m.status==='active')||!allowed(row.market)){await finish('cancelled','SOURCE_NOT_READY');return {status:'cancelled'};}
   if(!Array.isArray(payload.symbols)||!payload.symbols.length||payload.symbols.length>4||payload.symbols.some(s=>!known.has(s)))throw Error('INVALID_JOB');
   const result=await run(row.market,{symbols:payload.symbols,maxSymbols:4,budgetMs:90000});
   if(result.status==='busy'||result.status==='partial'||result.status==='blocked'||result.scanned<payload.symbols.length)throw Error('SOURCE_RETRY');
   await finish('done');return {status:'done'};
  }catch(e){const terminal=e.message==='INVALID_JOB'||row.attempts>=5;const delay=Math.min(300000,60000*2**(row.attempts-1));await finish(terminal?'failed':'retry',terminal?'JOB_FAILED':'SOURCE_RETRY',delay);return {status:terminal?'failed':'retry',delaySeconds:delay/1000};}
 }
 return {schedule,consume};
}
export const signalCloud=createSignalCloud();
