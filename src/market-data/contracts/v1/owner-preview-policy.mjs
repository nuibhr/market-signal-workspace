import {createHash,timingSafeEqual} from 'node:crypto';
export const OWNER_PREVIEW_COOKIE='nugaom_operator_preview';
const loopback=host=>['127.0.0.1','localhost','[::1]'].includes(host);
export function ownerPreviewEnabled(env=process.env,now=Date.now()){
 try{return env.NUGAOM_REVIEW_MODE==='true'&&env.NUGAOM_OWNER_SOURCE_PREVIEW==='true'&&loopback(new URL(env.APP_ORIGIN).hostname)&&/^[a-f0-9]{64}$/.test(env.CANONICAL_OWNER_PREVIEW_TOKEN??'')&&Number(env.CANONICAL_OWNER_PREVIEW_EXPIRES)>now;}catch{return false;}
}
export function validOwnerPreviewKey(key,env=process.env){return typeof key==='string'&&key.length===64&&timingSafeEqual(createHash('sha256').update(key).digest(),createHash('sha256').update(env.CANONICAL_OWNER_PREVIEW_TOKEN??'').digest());}
export function ownerPreviewAccess(request,env=process.env,now=Date.now()){
 if(!ownerPreviewEnabled(env,now))return false;
 try{
  const url=new URL(request.url),origin=new URL(env.APP_ORIGIN);
  if(!loopback(url.hostname)||(request.headers.get('host')??url.host)!==origin.host||request.headers.get('origin')&&request.headers.get('origin')!==origin.origin)return false;
  const cookie=(request.headers.get('cookie')??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(OWNER_PREVIEW_COOKIE+'='))?.slice(OWNER_PREVIEW_COOKIE.length+1);
  return validOwnerPreviewKey(cookie,env);
 }catch{return false;}
}
