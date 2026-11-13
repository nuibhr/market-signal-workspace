export function createWebBridgeClient({url,secret,fetcher=fetch}={}){
 const origin=new URL(url);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||typeof secret!=='string'||secret.length<43)throw Error('INVALID_WEB_BRIDGE_CONFIGURATION');
 async function call(path,data){
  let response;
  const safeRead=path==='/v1/storage'&&data.queries.every(q=>/^\s*SELECT\b/i.test(q.sql));
  for(let attempt=0;attempt<(safeRead?2:1);attempt++){
   try{response=await fetcher(new URL(path,origin),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(data),signal:AbortSignal.timeout(path==='/v1/ai'?55000:25000)});break;}
   catch{if(!safeRead||attempt===1)throw Error('WEB_BRIDGE_UNREACHABLE');}
  }
  // A failed mutation can already have committed; do not automatically replay it.
  if(!response.ok)throw Error(path==='/v1/ai'?'MODEL_UNAVAILABLE':'WEB_STORAGE_UNAVAILABLE');
  return response.json();
 }
 const batch=async queries=>queries.length?(await call('/v1/storage',{queries})).results:[];
 const one=async(sql,...params)=>(await batch([{sql,params}]))[0];
 return {storage:{kind:'d1-http',first:async(...a)=>(await one(...a)).results[0]??null,all:async(...a)=>(await one(...a)).results,run:async(...a)=>({changes:(await one(...a)).changes}),batch},ai:{run:(model,input)=>call('/v1/ai',{model,input})}};
}
