import {randomUUID} from 'node:crypto';
import {encodeScannerQuery} from './queries.mjs';
export function createScannerClient({url,secret,instance,fetcher=fetch,holder=randomUUID()}={}){
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/v1/scanner'||endpoint.search||endpoint.hash||!secret||secret.length<32||!/^[a-zA-Z0-9._-]{1,80}$/.test(instance??''))throw Error('INVALID_SCANNER_CONFIGURATION');
  async function call(action,queries){
    // No automatic replay of writes: a timeout may occur after D1 committed.
    let result;
    try{result=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({action,queries,holder,instance}),signal:AbortSignal.timeout(15000)});}
    catch{throw Object.assign(Error('SCANNER_BRIDGE_UNREACHABLE'),{code:'SCANNER_BRIDGE_UNREACHABLE'});}
    if(!result.ok){const code=result.status===409?'SCANNER_LEASE_BUSY':result.status===401?'SCANNER_UNAUTHORIZED':'SCANNER_BRIDGE_UNAVAILABLE';throw Object.assign(Error(code),{code});}
    const data=await result.json();
    if(!['release','status'].includes(action)&&(data.status!=='active'||!Array.isArray(data.results)))throw Error('INVALID_SCANNER_RESPONSE');
    if(action==='status'&&data.status!=='ready')throw Error('INVALID_SCANNER_RESPONSE');
    return data;
  }
  const batch=async queries=>queries.length?(await call('query',queries.map(encodeScannerQuery))).results:[];
  const one=async(sql,...params)=>(await batch([{sql,params}]))[0];
  return {status:()=>call('status'),heartbeat:()=>call('heartbeat'),release:()=>call('release'),
    storage:{kind:'scanner-http',
      first:async(...args)=>(await one(...args)).results[0]??null,
      all:async(...args)=>(await one(...args)).results,
      run:async(...args)=>({changes:(await one(...args)).changes}),batch,
    }};
}
