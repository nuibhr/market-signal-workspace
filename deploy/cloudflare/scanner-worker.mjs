import {withD1Database} from '../../src/storage/database.mjs';
import {signalCloud} from '../../src/signals/cloud.mjs';
export default {
  async scheduled(event,env,ctx){
    if(env.SCANNER_ENABLED!=='true')return;
    ctx.waitUntil(withD1Database(env.DB,async()=>{
      const result=await signalCloud.schedule(env.SCAN_QUEUE,event.scheduledTime);
      console.log(JSON.stringify({event:'scanner.scheduled',scheduledTime:event.scheduledTime,...result}));
    }));
  },
  async queue(batch,env){
    if(env.SCANNER_ENABLED!=='true'){batch.retryAll({delaySeconds:300});return;}
    await withD1Database(env.DB,async()=>{
      for(const message of batch.messages){
        try{if(message.body?.kind!=='swing'){message.ack();continue;}
          console.log(JSON.stringify({event:'scanner.job.started'}));
          const result=await signalCloud.consume(message.body?.id);
          console.log(JSON.stringify({event:'scanner.job',status:result.status}));
          if(result.status==='retry'||result.status==='busy')message.retry({delaySeconds:result.delaySeconds??60});
          else message.ack();
        }catch(error){console.error(JSON.stringify({event:'scanner.job.failed',errorType:error?.name??'Error'}));message.retry({delaySeconds:120});}
      }
    });
  },
  fetch(request,env){return Response.json({service:'nugaom-swing-signals',enabled:env.SCANNER_ENABLED==='true',scheduleMinutes:5},{headers:{'Cache-Control':'no-store'}});}
};
