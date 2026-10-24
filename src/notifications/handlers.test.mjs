import test from 'node:test';import assert from 'node:assert/strict';import {createTelegramHandlers} from './handlers.mjs';
const request=(body,origin='https://app.invalid',type='application/json')=>new Request('https://app.invalid/api/alerts/telegram',{method:'POST',headers:{Origin:origin,'Content-Type':type},body:typeof body==='string'?body:JSON.stringify(body)});
function setup(member={id:'admin'},admin=true){
 const calls=[];const handler=createTelegramHandlers({currentMember:async()=>member,isAdmin:m=>Boolean(m)&&admin,sameOrigin:r=>r.headers.get('Origin')==='https://app.invalid',rateLimit:async()=>null,env:{APP_ORIGIN:'https://app.invalid',TELEGRAM_BOT_TOKEN:'fixture-token',TELEGRAM_CHAT_ID:'fixture-channel'},send:async data=>{calls.push(data);return {messageId:7}},verify:async()=>({valid:true})});return {handler,calls};
}
test('public, cross-origin and non-admin requests never send using the server bot',async()=>{
 for(const [member,admin,origin]of [[null,false,'https://app.invalid'],[{id:'member'},false,'https://app.invalid'],[{id:'admin'},true,'https://other.invalid']]){
  const{handler,calls}=setup(member,admin);assert.ok((await handler.POST(request({action:'test'},origin))).status>=400);assert.equal(calls.length,0);
 }
});
test('malformed JSON, unsupported content type, oversized messages and destination overrides never dispatch',async()=>{
 const{handler,calls}=setup();
 for(const r of [request('{bad'),request({action:'test'},'https://app.invalid','text/plain'),request({action:'custom',text:'x'.repeat(13000)}),request({action:'test',chatId:'other'}),request({action:'unknown'})])assert.ok((await handler.POST(r)).status>=400);
 assert.equal(calls.length,0);
});
test('authorized connection test sends only the requested test through the configured channel',async()=>{
 const{handler,calls}=setup();const r=await handler.POST(request({action:'test'}));assert.equal(r.status,200);assert.equal(calls[0].chatId,'fixture-channel');assert.ok(calls[0].text.includes('ทดสอบ'));assert.equal(calls[0].text.includes('2720'),false);
});
