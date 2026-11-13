import test from 'node:test';
import assert from 'node:assert/strict';
import {generateChartAnalysis,parseSnapshot,DEFAULT_CHART_MODEL} from './chart-ai.mjs';
const snapshot={symbol:'PTT',timeframe:'1d',latestDay:'2026-10-22',barCount:250,price:32,support:30,resistance:34,ema20:31,ema50:30,rsi14:55,macdHistogram:0.1,trend:'up'};
const narrative={summary:'แนวโน้มอยู่เหนือค่าเฉลี่ยที่ระบุ',risk:'อินดิเคเตอร์เป็นข้อมูลย้อนหลัง และแท่งล่าสุดอาจยังไม่ปิด'};
test('production chart analysis uses the Workers AI binding and validates structured output',async()=>{
 let calls=0;const ai={async run(model,input){calls++;assert.equal(model,DEFAULT_CHART_MODEL);assert.equal(input.response_format.type,'json_schema');assert.ok(input.messages[1].content.includes('PTT'));return {response:narrative};}};
 const result=await generateChartAnalysis(parseSnapshot(snapshot),{ai,env:{NODE_ENV:'production'},fetcher:()=>{throw Error('localhost must not be used');}});
 assert.equal(calls,1);assert.deepEqual(result.narrative,narrative);assert.equal(result.provider,'Cloudflare Workers AI');assert.equal(result.timeframe,'1d');
 const string=await generateChartAnalysis(snapshot,{ai:{run:async()=>({response:JSON.stringify(narrative)})}});assert.deepEqual(string.narrative,narrative);
});
test('missing cloud binding and malformed provider output fail without a fabricated analysis',async()=>{
 await assert.rejects(generateChartAnalysis(snapshot,{env:{NODE_ENV:'production'}}),/CLOUD_AI_NOT_CONFIGURED/);
 for(const response of [{summary:'short'},'not JSON',{...narrative,risk:'x'.repeat(301)}])await assert.rejects(generateChartAnalysis(snapshot,{ai:{run:async()=>({response})}}),/INVALID_MODEL_RESPONSE/);
 await assert.rejects(generateChartAnalysis(snapshot,{ai:{run:()=>new Promise(()=>{})},timeoutMs:5}),{name:'TimeoutError'});
});
test('Demo chart replies are labeled samples and never invoke a real model',async()=>{
 const result=await generateChartAnalysis(snapshot,{demo:true,ai:{run:()=>{throw Error('must not call provider');}}});
 assert.equal(result.demo,true);assert.match(result.provider,/Demo/);assert.match(result.narrative.summary,/ตัวอย่าง/);
});
test('local development retains Ollama and snapshots reject unsupported or missing market inputs',async()=>{
 const result=await generateChartAnalysis(snapshot,{env:{NODE_ENV:'development'},fetcher:async(url,options)=>{assert.equal(url,'http://127.0.0.1:11434/api/generate');assert.equal(JSON.parse(options.body).stream,false);return Response.json({response:JSON.stringify(narrative)});}});
 assert.equal(result.provider,'Ollama local');
 assert.ok(parseSnapshot(snapshot));assert.equal(parseSnapshot({...snapshot,symbol:'UNKNOWN'}),null);assert.equal(parseSnapshot({...snapshot,barCount:1}),null);
 assert.equal(parseSnapshot({...snapshot,timeframe:'15m'}),null);
});
