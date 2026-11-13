import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import next from 'next';
if(process.env.STORAGE_PROVIDER!=='d1-http'||typeof process.env.VPS_ORIGIN_SECRET!=='string'||process.env.VPS_ORIGIN_SECRET.length<43)throw Error('VPS_WEB_CONFIGURATION_REQUIRED');
const origin=new URL(process.env.APP_ORIGIN);if(origin.protocol!=='https:')throw Error('HTTPS_ORIGIN_REQUIRED');
const expected=Buffer.from(process.env.VPS_ORIGIN_SECRET);
const app=next({dev:false,hostname:'0.0.0.0',port:3000});await app.prepare();const handle=app.getRequestHandler();
const server=http.createServer((req,res)=>{
 const token=Buffer.from(req.headers['x-nugaom-origin-secret']||'');
 if(token.length!==expected.length||!timingSafeEqual(token,expected)){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
 delete req.headers['x-nugaom-origin-secret'];
 req.headers.host=origin.host;req.headers['x-forwarded-host']=origin.host;req.headers['x-forwarded-proto']='https';
 req.headers['x-forwarded-for']=req.headers['x-nugaom-client-ip']||'';delete req.headers['x-nugaom-client-ip'];
 handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"code":"SERVER_TEMPORARILY_UNAVAILABLE"}');});
});server.requestTimeout=100000;server.headersTimeout=15000;server.listen(3000,'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),85000).unref();});
