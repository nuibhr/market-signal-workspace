import {randomUUID} from 'node:crypto';
import {readJsonBody,requestErrorResponse,RequestError} from '../security/request-guard.mjs';
import {formatTelegramTradeMessage,formatTelegramEaSignalMessage,formatTelegramAdminAnnouncement,sendTelegramMessage,verifyTelegramBot} from './broadcaster.mjs';
export function createTelegramHandlers({currentMember,isAdmin,sameOrigin,rateLimit,env=process.env,send=sendTelegramMessage,verify=verifyTelegramBot,history={list:async()=>[],start:async()=>true,finish:async()=>{}}}){
 const headers={'Cache-Control':'private, no-store'};
 const error=(code,status)=>Response.json({ok:false,error:code},{status,headers});
 return {
 async GET(){
  const member=await currentMember();if(!isAdmin(member))return error('FORBIDDEN',403);
  const limited=await rateLimit('telegram-status',member.id,12);if(limited)return limited;
  const configured=Boolean(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID);
  const bot=configured?await verify({token:env.TELEGRAM_BOT_TOKEN}):null;
  return Response.json({status:'ok',provider:'telegram',configured:configured&&bot?.valid===true,hasToken:Boolean(env.TELEGRAM_BOT_TOKEN),hasChatId:Boolean(env.TELEGRAM_CHAT_ID),chatIdMasked:env.TELEGRAM_CHAT_ID?env.TELEGRAM_CHAT_ID.slice(0,4)+'***':null,botName:bot?.botName||null,history:await history.list()},{headers});
 },
 async POST(request){
  if(!sameOrigin(request))return error('INVALID_ORIGIN',403);
  const member=await currentMember();if(!member)return error('SIGN_IN_REQUIRED',401);
  const limited=await rateLimit('telegram-dispatch',member.id,10);if(limited)return limited;
  let body;
  try{body=await readJsonBody(request,12288);}catch(e){return requestErrorResponse(e);}
  const ownToken=typeof body.token==='string'&&body.token.length>0;
  if(!isAdmin(member)&&(!ownToken||body.token===env.TELEGRAM_BOT_TOKEN))return error('FORBIDDEN',403);
  const token=ownToken?body.token:env.TELEGRAM_BOT_TOKEN,chatId=ownToken?body.chatId:env.TELEGRAM_CHAT_ID;
  if(!token||!chatId)return error('TELEGRAM_CREDENTIALS_REQUIRED',400);
  if(!ownToken&&body.chatId&&body.chatId!==env.TELEGRAM_CHAT_ID)return error('INVALID_DESTINATION',400);
  const action=body.action;
  if(!['verify','test','signal','ea-signal','announcement','custom'].includes(action))return error('INVALID_ACTION',400);
  if(action==='verify'){const bot=await verify({token});return Response.json({ok:bot.valid,botName:bot.botName,username:bot.username,error:bot.valid?null:'INVALID_TOKEN'},{status:bot.valid?200:400,headers});}
  let text,summary;
  try{
   const options={appOrigin:env.APP_ORIGIN||new URL(request.url).origin};
   if(action==='announcement'){
    if(typeof body.title!=='string'||body.title.length>160||typeof body.message!=='string'||!body.message.trim()||body.message.length>3000)throw new RequestError('INVALID_ANNOUNCEMENT',400);
    text=formatTelegramAdminAnnouncement({title:body.title,body:body.message,author:body.author||member.display_name||'Admin',...options});summary=body.title;
   }else if(action==='custom'){
    if(typeof body.text!=='string'||!body.text.trim()||body.text.length>3500)throw new RequestError('INVALID_TEXT',400);text=body.text;summary='Custom message';
   }else if(action==='ea-signal'){
    const s=body.eaSignal;
    if(!s||!['BUY','SELL','LONG','SHORT'].includes(s.side)||!['ENTRY','LOCK_PROFIT','TP1','TP2'].includes(s.stage)||![s.entry,s.stopLoss,s.lockBuffer,s.tp1,s.tp2].every(v=>Number.isFinite(v)&&v>0)||!/^[-A-Z0-9./_]{1,32}$/.test(s.symbol))throw new RequestError('INVALID_SIGNAL',400);
    text=formatTelegramEaSignalMessage(s,options);summary=s.symbol+' '+s.stage;
   }else if(action==='signal'){
    const s=body.signal;
    if(!s||!['LONG','SHORT'].includes(s.side)||!/^[-A-Z0-9./_]{1,32}$/.test(s.symbol)||![s.plan?.entry,s.plan?.stop,s.plan?.target].every(v=>Number.isFinite(v)&&v>0))throw new RequestError('INVALID_SIGNAL',400);
    text=formatTelegramTradeMessage(s,options);summary=s.symbol+' '+s.side;
   }else{text='✅ ข้อความทดสอบการเชื่อมต่อ Nugaom AI · ไม่มีคำสั่งเทรด';summary='Connection test';}
  }catch(e){return requestErrorResponse(e);}
  if(text.length>4000)return error('MESSAGE_TOO_LONG',400);
  const globalLimit=await rateLimit('telegram-provider',ownToken?member.id:'vip-channel',18);if(globalLimit)return globalLimit;
  const operationId=body.operationId||randomUUID();
  if(typeof operationId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(operationId))return error('INVALID_OPERATION_ID',400);
  const id=member.id+':'+operationId,logDelivery=isAdmin(member);
  if(logDelivery&&!(await history.start({id,actor:member.id,summary})))return error('ALREADY_SUBMITTED',409);
  try{
   const result=await send({token,chatId,text,parseMode:'HTML'});
   if(logDelivery)await history.finish(id,'SENT',result.messageId);
   return Response.json({ok:true,messageId:result.messageId},{headers});
  }catch{
   if(logDelivery)await history.finish(id,'CHECK_REQUIRED',null);
   return error('TELEGRAM_DISPATCH_FAILED',502);
  }
 }
 };
}
