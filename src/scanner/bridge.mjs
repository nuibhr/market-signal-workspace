import {timingSafeEqual} from 'node:crypto';
import {decodeScannerQuery} from './queries.mjs';

export const SCANNER_LEASE_MS=120000;
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const sameSecret=(value,expected)=>{
  if(typeof expected!=='string'||expected.length<32)return false;
  const a=Buffer.from(value??''),b=Buffer.from(`Bearer ${expected}`);
  return a.length===b.length&&timingSafeEqual(a,b);
};
async function boundedJson(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_REQUEST');
  const reader=request.body?.getReader();if(!reader)throw Error('INVALID_REQUEST');
  const parts=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;
    if(size>1024*1024)throw Error('REQUEST_TOO_LARGE');parts.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

// All operations (including reads) are fenced in one D1 transaction. An old
// process cannot commit a buffered scan after another VPS has taken ownership.
export async function scannerBridge(request,env,{clock=Date.now}={}){
  const path=new URL(request.url).pathname;
  if(path!=='/v1/scanner'||request.method!=='POST')return response({code:'NOT_FOUND'},404);
  if(!sameSecret(request.headers.get('authorization'),env.SCANNER_BRIDGE_SECRET))return response({code:'UNAUTHORIZED'},401);
  if(env.SCANNER_BRIDGE_ENABLED!=='true')return response({code:'SCANNER_BRIDGE_DISABLED'},503);
  let input,queries;
  try{
    input=await boundedJson(request);
    if(!/^[a-f0-9-]{36}$/.test(input.holder??'')||!/^[a-zA-Z0-9._-]{1,80}$/.test(input.instance??''))throw Error('INVALID_REQUEST');
    if(!['status','heartbeat','release','query'].includes(input.action))throw Error('INVALID_REQUEST');
    if(input.action==='query'){
      if(!Array.isArray(input.queries)||!input.queries.length||input.queries.length>32)throw Error('INVALID_REQUEST');
      queries=input.queries.map(decodeScannerQuery);
    }
  }catch{return response({code:'INVALID_REQUEST'},400);}
  const now=clock(),statement=(sql,params=[])=>env.DB.prepare(sql).bind(...params);
  try{
    if(input.action==='status'){
      const lease=await statement('SELECT instance,until_ms,heartbeat_ms FROM scanner_bridge_lease WHERE id=1').first();
      return response({status:'ready',owner:lease?.until_ms>now?lease.instance:null,heartbeatMs:lease?.heartbeat_ms??null});
    }
    if(input.action==='release'){
      await statement('UPDATE scanner_bridge_lease SET until_ms=0 WHERE id=1 AND holder=?',[input.holder]).run();
      return response({status:'released'});
    }
    const lease=input.action==='heartbeat'?[
      statement(`INSERT INTO scanner_bridge_lease VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        holder=excluded.holder,instance=excluded.instance,until_ms=excluded.until_ms,heartbeat_ms=excluded.heartbeat_ms
        WHERE scanner_bridge_lease.until_ms<=? OR scanner_bridge_lease.holder=excluded.holder`,[input.holder,input.instance,now+SCANNER_LEASE_MS,now,now])]:[];
    const results=await env.DB.batch([
      ...lease,
      // A valid fence inserts zero rows. Only an invalid lease attempts the
      // forbidden value, aborting this transaction without a write per read.
      statement(`INSERT INTO scanner_bridge_guard SELECT 1,0 WHERE NOT EXISTS(
        SELECT 1 FROM scanner_bridge_lease WHERE id=1 AND holder=? AND until_ms>?)`,[input.holder,now]),
      ...(queries??[]).map(q=>statement(q.sql,q.params)),
    ]);
    if(results.some(r=>r.success===false))throw Error('STORAGE_QUERY_FAILED');
    return response({status:'active',leaseUntil:now+SCANNER_LEASE_MS,
      results:results.slice(lease.length+1).map(r=>({results:r.results??[],changes:r.meta?.changes??0}))});
  }catch(error){
    if(`${error.message} ${error.cause?.message}`.includes('scanner_lease_required'))return response({code:'SCANNER_LEASE_BUSY'},409);
    // Never echo SQL, parameters, provider payloads or authentication headers.
    return response({code:'SCANNER_STORAGE_UNAVAILABLE'},503);
  }
}
