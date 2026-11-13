import test from 'node:test';
import assert from 'node:assert/strict';
import {researchWithBigdata} from './bigdata-research.mjs';
process.env.BIGDATA_API_KEY='fixture-key';
const event=message=>`data:${JSON.stringify({chat_id:'chat-fixture',message})}\r\n\r\n`;
const answer=event({type:'ANSWER',content:'คำตอบภาษาไทย'});
const grounding=event({type:'GROUNDING',references:[{source:{title:'Apple filing',url:'https://www.apple.com/',timestamp:'2026-10-24'}}]});
const complete=event({type:'COMPLETE',checkpoint_id:'checkpoint-fixture'});
function stream(text){
 const bytes=new TextEncoder().encode(text);let cursor=0;
 return new Response(new ReadableStream({pull(controller){if(cursor>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(cursor,cursor+7));cursor+=7;}}));
}
test('Workers fetch handles split UTF-8, SSE without spaces and a final unterminated event',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(options.headers['X-API-KEY'],'fixture-key');assert.equal(JSON.parse(options.body).chat_id,'previous');return stream(answer+grounding+complete.trimEnd());});
 const result=await researchWithBigdata('Apple','AAPL',{chatId:'previous'});
 assert.equal(result.answer,'คำตอบภาษาไทย');assert.equal(result.sources.length,1);assert.equal(result.chatId,'chat-fixture');assert.equal(result.checkpointId,'checkpoint-fixture');
});
test('a disconnected or ungrounded answer is not accepted for quota charging',async t=>{
 let payload=answer+grounding;t.mock.method(globalThis,'fetch',async()=>stream(payload));
 await assert.rejects(researchWithBigdata('Apple'),/BIGDATA_INCOMPLETE_RESPONSE/);
 payload=answer+complete;await assert.rejects(researchWithBigdata('Apple'),/BIGDATA_UNGROUNDED/);
 payload=answer+grounding+event({type:'ERROR'})+complete;await assert.rejects(researchWithBigdata('Apple'),/BIGDATA_EMPTY_RESPONSE/);
});
test('provider authentication and capacity errors have stable public codes',async t=>{
 let status=401;t.mock.method(globalThis,'fetch',async()=>new Response(null,{status}));
 await assert.rejects(researchWithBigdata('Apple'),/BIGDATA_AUTH_FAILED/);
 status=429;await assert.rejects(researchWithBigdata('Apple'),/BIGDATA_RATE_LIMIT/);
});
