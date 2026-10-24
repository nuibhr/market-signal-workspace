import test from 'node:test';import assert from 'node:assert/strict';
import {createTelegramHandlers} from '../../../../notifications/handlers.mjs';
const handlers=createTelegramHandlers({currentMember:async()=>({id:'fixture-admin'}),isAdmin:()=>true,sameOrigin:r=>r.headers.get('Origin')==='https://app.invalid',rateLimit:async()=>null,env:{},verify:async()=>{throw Error('Must not call Telegram without credentials')}});
test('admin status identifies the provider and reports unconfigured credentials truthfully',async()=>{
 const res=await handlers.GET();const data=await res.json();assert.equal(res.status,200);assert.equal(data.status,'ok');assert.equal(data.provider,'telegram');assert.equal(data.configured,false);assert.equal(data.hasToken,false);assert.equal(data.chatIdMasked,null);
});
test('an authenticated same-origin request rejects missing credentials before dispatch',async()=>{
 const res=await handlers.POST(new Request('https://app.invalid/api/alerts/telegram',{method:'POST',headers:{Origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({action:'test',token:'',chatId:''})}));
 assert.equal(res.status,400);assert.equal((await res.json()).error,'TELEGRAM_CREDENTIALS_REQUIRED');
});
