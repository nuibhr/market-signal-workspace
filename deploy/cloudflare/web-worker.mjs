import handler from '../../.open-next/worker.js';
import { withD1Database } from '../../src/storage/database.mjs';
import {createHash,timingSafeEqual} from 'node:crypto';
function authorizedReview(request,env){
  const value=request.headers.get('x-nugaom-launch-review');
  if(!value||!env.LAUNCH_REVIEW_SECRET)return false;
  const digest=text=>createHash('sha256').update(text).digest();
  return timingSafeEqual(digest(value),digest(env.LAUNCH_REVIEW_SECRET));
}
export default {
  async fetch(request,env,ctx){
    if(env.LAUNCH_MAINTENANCE==='true'&&new URL(request.url).pathname!=='/api/health'&&!authorizedReview(request,env))return new Response('กำลังเตรียมระบบ Nugaom AI Pick กรุณากลับมาอีกครั้ง',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'300'}});
    return withD1Database(env.DB,()=>handler.fetch(request,env,ctx));
  }
};
