import {randomUUID} from 'node:crypto';
import {storage} from '../storage/database.mjs';
import {signalUniverse} from '../signals/data.mjs';
import {signalId} from '../signals/model.mjs';
import {SCANNER_QUERIES} from './queries.mjs';

export async function enqueueScannerRequest(market,symbols,now=Date.now()){
  const known=new Set(signalUniverse(market).map(a=>a.symbol));
  if(!['thai','dr','us'].includes(market)||!Array.isArray(symbols)||!symbols.length||symbols.length>6||symbols.some(s=>!known.has(s)))throw Object.assign(Error('INVALID_SYMBOLS'),{code:'INVALID_SYMBOLS'});
  const selected=[...new Set(symbols)].sort(),at=new Date(now).toISOString();
  const id=signalId(`vps-manual:${market}:${Math.floor(now/30000)}:${selected.join(',')}`);
  await storage.run(`INSERT OR IGNORE INTO scanner_jobs(id,market,session_key,slot,payload_json,available_at,created_at,updated_at,priority) VALUES(?,?,?,?,?,?,?,?,0)`,id,market,'vps-manual',at,JSON.stringify({kind:'swing-manual',symbols:selected}),now,at,at);
  return {status:'queued',requestId:id,scanned:0};
}
export async function runVpsMarket(market,run,now=Date.now()){
  const token=randomUUID();
  const job=await storage.first(SCANNER_QUERIES['request.claim'],token,now+120000,market,new Date(now-600000).toISOString(),now,now);
  if(!job)return run(market);
  let result;
  try{
    const {symbols}=JSON.parse(job.payload_json),known=new Set(signalUniverse(market).map(a=>a.symbol));
    if(!Array.isArray(symbols)||!symbols.length||symbols.length>6||symbols.some(s=>!known.has(s)))throw Error('INVALID_JOB');
    result=await run(market,{symbols,force:true,maxSymbols:6,budgetMs:20000});
    const remaining=result.status==='busy'?symbols:symbols.slice(result.scanned??0),retry=remaining.length>0;
    await storage.run(SCANNER_QUERIES['request.finish'],retry?(job.attempts>=5?'failed':'retry'):'done',retry?'SCAN_IN_PROGRESS':result.errors?.length?'SOURCE_PARTIAL':null,now+30000,JSON.stringify({kind:'swing-manual',symbols:remaining}),new Date(now).toISOString(),job.id,token);
  }catch(error){
    await storage.run(SCANNER_QUERIES['request.finish'],job.attempts>=5?'failed':'retry','SCANNER_REQUEST_FAILED',now+30000,job.payload_json,new Date(now).toISOString(),job.id,token);
    throw error;
  }
  return {...result,requestId:job.id};
}
