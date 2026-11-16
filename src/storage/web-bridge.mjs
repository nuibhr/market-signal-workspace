import {timingSafeEqual} from 'node:crypto';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function bridgeAuthorized(request,secret){
 if(typeof secret!=='string'||secret.length<43)return false;
 const a=Buffer.from(request.headers.get('authorization')||''),b=Buffer.from(`Bearer ${secret}`);
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_REQUEST');
 const reader=request.body?.getReader();if(!reader)throw Error('INVALID_REQUEST');
 const parts=[];let bytes=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2*1024*1024)throw Error('INVALID_REQUEST');parts.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export function webStatement(q){
 if(!q||typeof q.sql!=='string'||q.sql.length>32000||!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(q.sql)||/;|--|\/\*|\b(?:PRAGMA|ATTACH|DETACH|CREATE|ALTER|DROP|VACUUM|load_extension|sqlite_master|sqlite_schema)\b/i.test(q.sql))throw Error('INVALID_QUERY');
 if(!Array.isArray(q.params)||q.params.length>100||q.params.some(p=>p!==null&&typeof p!=='string'&&(typeof p!=='number'||!Number.isFinite(p))))throw Error('INVALID_QUERY');
 return q;
}
// A server service principal, separate from the narrow scanner credential.
// Only the private Node backend receives this credential. Never expose it to a browser.
export async function webBridge(request,env){
 if(request.method!=='POST')return reply({code:'NOT_FOUND'},404);
 if(!bridgeAuthorized(request,env.WEB_BRIDGE_SECRET))return reply({code:'UNAUTHORIZED'},401);
 let data;try{data=await body(request);}catch{return reply({code:'INVALID_REQUEST'},400);}
 const path=new URL(request.url).pathname;
 if(path==='/v1/ai'){
  if(data.model!==env.AI_ANALYSIS_MODEL||!Array.isArray(data.input?.messages)||data.input.messages.length>3||JSON.stringify(data.input).length>12000||data.input.max_tokens!==650)return reply({code:'INVALID_REQUEST'},400);
  try{return reply(await env.AI.run(data.model,data.input));}catch{return reply({code:'MODEL_UNAVAILABLE'},503);}
 }
 if(path!=='/v1/storage')return reply({code:'NOT_FOUND'},404);
 let queries;try{
  if(!Array.isArray(data.queries)||!data.queries.length||data.queries.length>32)throw Error();
  queries=data.queries.map(webStatement);
 }catch{return reply({code:'INVALID_QUERY'},400);}
 try{
  const results=await env.DB.batch(queries.map(q=>env.DB.prepare(q.sql).bind(...q.params)));
  if(results.some(r=>r.success===false))throw Error();
  return reply({results:results.map(r=>({results:r.results||[],changes:r.meta?.changes||0}))});
 }catch{return reply({code:'WEB_STORAGE_UNAVAILABLE'},503);}
}
