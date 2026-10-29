import test from 'node:test';import assert from 'node:assert/strict';
import {createDailyBatch,dailyWindow} from './daily.mjs';
test('daily boundary is 07:00 Bangkok across UTC dates',()=>{
 const before=Date.parse('2026-10-23T23:59:59Z'),after=before+1000;
 assert.equal(dailyWindow(before).key,'2026-10-23');assert.equal(dailyWindow(after).key,'2026-10-24');
 assert.equal(dailyWindow(after).next,Date.parse('2026-10-25T00:00:00Z'));
});
test('daily batches persist progress, skip completed days, and resume without repeating an interrupted batch',async()=>{
 let now=Date.parse('2026-10-24T01:00:00Z'),calls=[],saved;
 const db={first:async()=>saved?{payload_json:saved}:null,run:async(_s,_id,payload)=>{saved=payload;}};
 const universe=()=>Array.from({length:10},(_,i)=>({symbol:'S'+i}));
 const run=async(_m,opts)=>{calls.push(opts.symbols);return {status:'complete',scanned:opts.symbols.length};};
 const step=createDailyBatch({db,universe,run,clock:()=>now});
 assert.equal((await step('thai')).progress,8);assert.equal((await step('thai')).status,'daily-complete');
 await createDailyBatch({db,universe,run,clock:()=>now})('thai');assert.equal(calls.length,2,'Restart does not repeat the complete day');
 saved=JSON.stringify({next:8,attempted:0,interrupted:0,reserved:['S0','S1','S2','S3','S4','S5','S6','S7']});calls=[];
 const done=await step('thai');assert.deepEqual(calls,[['S8','S9']]);assert.equal(done.interrupted,8);
});
