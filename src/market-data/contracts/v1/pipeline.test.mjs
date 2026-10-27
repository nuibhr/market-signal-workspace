import test from 'node:test';
import assert from 'node:assert/strict';
import {projectEnvelope,normalizeRecord,canonicalTier,displayRights} from './pipeline.mjs';
import {validateOutput} from './schema-validator.mjs';
import {apiError} from './http.mjs';
const now=Date.parse('2026-10-26T12:00:00Z'),stamp='2026-10-26T10:00:00Z';
const evidence=Object.fromEntries(['settrade','yahoo','fmp','owner-ingest'].map(id=>[id,{status:'CONFIRMED',markets:['thai','dr','us','tfex','forex'],evidenceId:'FIXTURE_ONLY_NOT_A_LICENSE',verifiedAt:'2026-10-01T00:00:00Z',validUntil:'2026-11-01T00:00:00Z'}]));
const calendar=()=>({verified:true,closeAt:stamp});
const policy={id:'fixture-only',maxAgeSeconds:30};
function input(market='thai',i=0){return {market,symbol:`F${i}`,instrumentId:`FIXTURE:${market}:${i}`,providerId:'settrade',providerState:'READY',dataMode:'EOD',dataKind:{thai:'SCANNER_CANDIDATE',dr:'DR_DAILY_BAR',us:'EQUITY_EOD',tfex:'FUTURES_CANDIDATE',forex:'SCAN_CANDIDATE'}[market],dataAsOf:stamp,receivedAt:stamp,closed:true,qualityVerified:true,data:{price:100,changePct:1,entry:101,token:'NEVER_SERIALIZE'}};}
const options=(market='thai',tier='TRIAL')=>({market,tier,now,evidence,calendar,policy});
test('five markets and all tier caps validate against JSON schema; guest never receives full fields',()=>{
 for(const market of ['thai','dr','us','tfex','forex'])for(const [tier,cap] of Object.entries({GUEST:1,TRIAL:8,STARTER:3,PRO:5,ULTIMATE:8})){
  const e=projectEnvelope(Array.from({length:20},(_,i)=>input(market,i)),options(market,tier));
  assert.equal(e.records.length,cap);assert.equal(validateOutput(e).valid,true,JSON.stringify(validateOutput(e)));
  assert.ok(!JSON.stringify(e).includes('NEVER_SERIALIZE'));
  assert.ok(e.records.every(r=>r.source.isLiveFeed===false&&r.eligibility.performance===false&&r.eligibility.execution===false));
  if(tier==='GUEST')assert.deepEqual(Object.keys(e.records[0].data),market==='forex'?[]:['changePct']);
 }
});
test('query, page, symbol, diagnostics cannot reveal rows beyond stable entitled selection',()=>{
 const rows=Array.from({length:20},(_,i)=>input('thai',i));
 for(const query of [{page:2},{symbol:'F9'},{q:'F9'}]){
  const e=projectEnvelope(rows,{...options('thai','STARTER'),query});assert.equal(e.records.length,0);assert.equal(e.coverage.computedTotal,0);
 }
 const e=projectEnvelope([...rows,input('us')],options('thai','STARTER'));assert.equal(e.coverage.visibleTotal,3);assert.equal(e.coverage.catalogTotal,null);
});
test('source timestamps never come from receipt, generation or cache read',()=>{
 for(const dataAsOf of [null,undefined,'bad']){
  const r=normalizeRecord({...input(),dataAsOf},options());assert.equal(r.timestamps.dataAsOf,null);assert.equal(r.status.freshness,'UNKNOWN');assert.equal(r.eligibility.signal,false);
 }
 const r=normalizeRecord({...input(),dataAsOf:'2026-10-27T00:00:00Z'},options());assert.ok(r.statusCodes.includes('FUTURE_TIMESTAMP'));assert.equal(r.eligibility.signal,false);
 const original=normalizeRecord(input(),options());const later=normalizeRecord(input(),{...options(),now:now+1000});assert.equal(original.timestamps.receivedAt,later.timestamps.receivedAt);
});
test('stale, fallback, missing calendar and unverified quality cannot signal',()=>{
 for(const patch of [{dataAsOf:'2026-10-22T10:00:00Z'},{fallback:true},{qualityVerified:false},{closed:false}]){
  const r=normalizeRecord({...input(),...patch},options());assert.equal(r.eligibility.signal,false);assert.equal(r.eligibility.performance,false);assert.equal(r.eligibility.chart,true);assert.equal(r.data.entry,undefined);
 }
 assert.equal(normalizeRecord(input(),{...options(),calendar:()=>null}).status.freshness,'UNKNOWN');
});
test('rights and provider failures block values and unknown runtime evidence is never a license',()=>{
 for(const evidence of [{},{settrade:{status:'CONFIRMED'}},{settrade:{...options().evidence.settrade,status:'DENIED'}},{settrade:{...options().evidence.settrade,validUntil:stamp}}]){
  const r=normalizeRecord(input(),{...options(),evidence});assert.deepEqual(r.data,{});assert.equal(r.status.usability,'BLOCKED');
 }
 for(const providerState of ['UNAVAILABLE','NOT_CONFIGURED','unknown payload secret'])assert.deepEqual(normalizeRecord({...input(),providerState},options()).data,{});
});
test('OHLC, duplicate, out of order and incomplete bars are rejected',()=>{
 const b={time:now/1000-1800,open:1,high:2,low:1,close:2};
 for(const bars of [[{...b,low:3}],[b,b],[b,{...b,time:b.time-900}],[{...b,time:now/1000}],[{...b,closed:false}]]){
  const r=normalizeRecord({...input(),data:{bars,timeframe:'15m'}},options());assert.equal(r.status.availability,'UNAVAILABLE');assert.deepEqual(r.data,{});
 }
});
test('DR prerequisites block valuation and signal',()=>{
 const r=normalizeRecord({...input('dr'),dataKind:'DR_BRIDGE',bridge:null,data:{price:1,entry:2,fairValue:3}},options('dr'));
 for(const code of ['NOT_MAPPED','MISSING_UNDERLYING','MISSING_FX','CURRENCY_MISMATCH','AS_OF_NOT_ALIGNED'])assert.ok(r.statusCodes.includes(code));
 assert.equal(r.eligibility.signal,false);assert.equal(r.data.fairValue,undefined);
});
test('Forex requires owner ingestion, heartbeat, quote time and sixty CLOSED 15m bars',()=>{
 const row={...input('forex'),providerId:'owner-ingest',dataMode:'DELAYED',ownerIngest:true,connectionActive:true,heartbeatAt:new Date(now-1000).toISOString(),dataAsOf:new Date(now-1000).toISOString(),data:{price:1,timeframe:'15m',bars:Array.from({length:60},(_,i)=>({time:now/1000-(60-i)*900,open:1,high:2,low:1,close:2}))}};
 assert.equal(normalizeRecord(row,options('forex')).eligibility.signal,true);
 for(const patch of [{data:{...row.data,bars:row.data.bars.slice(1)}},{heartbeatAt:stamp},{ownerIngest:false},{connectionActive:false},{dataAsOf:stamp}])assert.equal(normalizeRecord({...row,...patch},options('forex')).eligibility.signal,false);
});
test('TFEX missing OI stays null and reference cannot signal',()=>{
 const r=normalizeRecord({...input('tfex'),dataMode:'REFERENCE'},options('tfex'));assert.equal(r.data.openInterest,null);assert.equal(r.eligibility.signal,false);
});
test('shape rejects extra secrets, malformed timestamps, unknown enums and caps; diagnostics contain no secret names',async()=>{
 const e=projectEnvelope([input()],options());
 for(const mutate of [x=>x.secret='secret',x=>x.timestamps.generatedAt='bad',x=>x.status.rights='bogus',x=>x.entitlement.maxFullCards=9]){
  const copy=structuredClone(e);mutate(copy);assert.equal(validateOutput(copy).valid,false);
 }
 const err=await apiError('FORBIDDEN',now).json();assert.equal(validateOutput(err).valid,true);
 err.error['secret-token-in-key']='secret-value';const result=validateOutput(err);assert.equal(result.valid,false);assert.ok(!JSON.stringify(result).includes('secret'));
});
test('server membership mapping preserves the entitlement ladder',()=>{
 for(const [planId,tier] of [['starter','STARTER'],['pro','PRO'],['ultimate','ULTIMATE']])assert.equal(canonicalTier({tier:'subscriber',planId}),tier);
 assert.equal(canonicalTier({tier:'trial'}),'TRIAL');assert.equal(canonicalTier({tier:'expired'}),'GUEST');assert.equal(canonicalTier({tier:'subscriber',planId:'attacker'}),'GUEST');
});
test('invalid prices, crossed quotes, negative volume and empty data never become available',()=>{
 for(const data of [{price:-1},{price:NaN},{price:1,bid:2,ask:1},{price:1,volume:-1},{price:1,openInterest:-1},{}]){
  const row=normalizeRecord({...input(),data},options());
  assert.equal(row.status.availability,'UNAVAILABLE');assert.equal(row.eligibility.signal,false);assert.deepEqual(row.data,{});
 }
});
