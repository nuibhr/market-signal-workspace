import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSource} from './native-source.mjs';
import {projectEnvelope} from './pipeline.mjs';
const now=Date.parse('2026-10-28T08:00:00Z'),received='2026-10-28T07:59:00Z';
const assets=market=>Array.from({length:12},(_,i)=>({id:market,symbol:'S'+i,instrumentId:'FIXTURE:'+i}));
const bars=[{time:'2026-10-26',open:10,high:12,low:9,close:11,volume:1,token:'NEVER_LEAK'},{time:'2026-10-27',open:11,high:13,low:10,close:12,volume:1},{time:'2026-10-28',open:12,high:14,low:11,close:13,volume:1}];
const client={configuration:{configured:true},getDailyCandles:async symbol=>({symbol,timeframe:'1d',receivedAt:received,bars}),getQuote:async symbol=>({symbol,status:'available',price:100,openInterest:null,observedAt:null,receivedAt:received})};
const create=(overrides={})=>createNativeSource({assets,createSettrade:()=>client,createTfex:()=>client,getUsBars:async symbol=>({symbol,timeframe:'1d',receivedAt:received,bars}),clock:()=>now,...overrides});
test('native SET/DR loads actual closed bars without a scanner DB, excludes current day and strips secret fields',async()=>{
 for(const market of ['thai','dr']){
  const rows=await create()(market);assert.equal(rows.length,market==='dr'?6:8);
  assert.equal(rows[0].data.price,12);assert.equal(rows[0].dataAsOf,'2026-10-27T10:00:00.000Z');assert.equal(rows[0].receivedAt,received);
  assert.equal(rows[0].qualityVerified,false);assert.ok(!JSON.stringify(rows).includes('NEVER_LEAK'));
  assert.deepEqual(projectEnvelope(rows,{market,tier:'TRIAL',now}).records[0].data,{},'native availability never bypasses customer display rights');
 }
});
test('native source caches receipt without rewriting and keeps provider failures per row',async()=>{
 let calls=0;const load=create({createSettrade:()=>({...client,getDailyCandles:async symbol=>{calls++;if(symbol==='S1')throw {code:'AUTH_FAILED'};return {symbol,timeframe:'1d',receivedAt:received,bars};}})});
 const first=await load('thai'),second=await load('thai',{symbol:'S0'});assert.equal(calls,8);assert.equal(second[0].receivedAt,received);assert.equal(first[1].available,false);assert.equal(first[1].failureCode,'AUTH_FAILED');
});
test('wrong identity, duplicate/invalid OHLC and missing provider never emit prices',async()=>{
 for(const patch of [{symbol:'OTHER'},{bars:[bars[0],bars[0]]},{bars:[{...bars[0],low:50}]},{bars:[{...bars[0],time:'2026-02-31'}]}]){
  const load=create({createSettrade:()=>({...client,getDailyCandles:async symbol=>({symbol,timeframe:'1d',receivedAt:received,bars,...patch})})});
  const row=(await load('thai'))[0];assert.equal(row.available,false);assert.deepEqual(row.data,{});
 }
 assert.equal((await create({createSettrade:()=>({configuration:{configured:false}})})('thai'))[0].attempted,false);
});
test('TFEX quote retains unknown source time and null OI; crossed quote is unavailable',async()=>{
 const row=(await create()('tfex'))[0];assert.equal(row.dataAsOf,null);assert.equal(row.observedAt,null);assert.equal(row.data.openInterest,null);assert.equal(row.receivedAt,received);
 const load=create({createTfex:()=>({...client,getQuote:async symbol=>({symbol,status:'available',price:100,bid:102,ask:101})})});assert.equal((await load('tfex'))[0].available,false);
});
