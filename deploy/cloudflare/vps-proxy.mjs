export async function proxyRequest(request,env,fetcher=fetch){
 let target;
 try{target=new URL(env.VPS_ORIGIN);if(target.protocol!=='https:'||target.username||target.password||target.pathname!=='/'||target.search||target.hash||typeof env.VPS_ORIGIN_SECRET!=='string'||env.VPS_ORIGIN_SECRET.length<43)throw Error();}
 catch{return Response.json({code:'ORIGIN_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});}
 const url=new URL(request.url);target.pathname=url.pathname;target.search=url.search;
 const headers=new Headers(request.headers);
 for(const key of ['host','forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for','x-nugaom-origin-secret','x-nugaom-client-ip'])headers.delete(key);
 headers.set('x-nugaom-origin-secret',env.VPS_ORIGIN_SECRET);
 headers.set('x-nugaom-client-ip',request.headers.get('cf-connecting-ip')||'');
 headers.set('x-forwarded-host',url.host);headers.set('x-forwarded-proto','https');
 try{return await fetcher(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(90000)});}
 catch{return Response.json({status:'unavailable',code:'SERVER_TEMPORARILY_UNAVAILABLE',message:'เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองใหม่อีกครั้ง'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'30'}});}
}
export default {fetch:(request,env)=>proxyRequest(request,env)};
