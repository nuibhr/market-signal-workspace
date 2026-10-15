import {withD1Database} from '../../src/storage/database.mjs';
import {signalCloud} from '../../src/signals/cloud.mjs';
export default {
  async scheduled(event,env,ctx){
    if(env.SCANNER_ENABLED!=='true')return;
    ctx.waitUntil(withD1Database(env.DB,()=>signalCloud.schedule(env.SCAN_QUEUE,event.scheduledTime)));
  },
  async queue(batch,env){
    if(env.SCANNER_ENABLED!=='true'){batch.retryAll({delaySeconds:300});return;}
    await withD1Database(env.DB,async()=>{
      for(const message of batch.messages){
        try{if(message.body?.kind!=='swing'){message.ack();continue;}const result=await signalCloud.consume(message.body?.id);
          if(result.status==='retry'||result.status==='busy')message.retry({delaySeconds:result.delaySeconds??60});
          else message.ack();
        }catch{message.retry({delaySeconds:120});}
      }
    });
  },
  fetch(){return Response.json({service:'nugaom-swing-signals',scheduleMinutes:5},{headers:{'Cache-Control':'no-store'}});}
};
