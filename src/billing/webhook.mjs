import {RequestError,requestErrorResponse} from '../security/request-guard.mjs';
import {stripeClient} from './client.mjs';
import {applyStripeEvent} from './store.mjs';
const privateHeaders={'Cache-Control':'private, no-store'};
const failed=()=>Response.json({error:'STRIPE_NOT_CONFIGURED'},{status:503,headers:privateHeaders});
async function rawBody(request,maximum){
  if(Number(request.headers.get('content-length'))>maximum)throw new RequestError('PAYLOAD_TOO_LARGE',413);
  const reader=request.body?.getReader();if(!reader)throw new RequestError('INVALID_STRIPE_EVENT',400);
  const chunks=[];let total=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new RequestError('PAYLOAD_TOO_LARGE',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
export async function webhookHandler(request,{stripe,secret=process.env.STRIPE_WEBHOOK_SECRET}={}){
  if(!secret?.startsWith('whsec_'))return failed();
  let client,event;
  try{
    client=stripe??stripeClient();
    const body=await rawBody(request,262144);
    event=await client.webhooks.constructEventAsync(body,request.headers.get('stripe-signature')??'',secret);
  }catch(error){if(error.message==='STRIPE_NOT_CONFIGURED')return failed();if(error instanceof RequestError)return requestErrorResponse(error);return Response.json({error:'INVALID_WEBHOOK_SIGNATURE'},{status:400,headers:privateHeaders});}
  try{return Response.json({received:true,...await applyStripeEvent(event,{stripe:client})},{headers:privateHeaders});}
  catch{return Response.json({error:'WEBHOOK_RETRY_REQUIRED'},{status:500,headers:privateHeaders});}
}
