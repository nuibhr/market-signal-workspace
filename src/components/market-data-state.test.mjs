import test from 'node:test';import assert from 'node:assert/strict';
import {marketDataState,sourceTime} from './market-data-state.mjs';
test('rights denial never offers a membership upsell, while redaction does',()=>{
 for(const code of ['DISPLAY_RIGHTS_NOT_CONFIRMED','DISPLAY_RIGHTS_EXPIRED','DISPLAY_RIGHTS_DENIED']){
  const state=marketDataState({record:{status:{codes:[code,'QUALITY_REJECTED'],availability:'UNAVAILABLE'}}});
  assert.equal(state.kind,'rights');assert.equal(state.href,undefined);assert.equal(state.retry,undefined);
 }
 assert.equal(marketDataState({record:{projection:'REDACTED',status:{codes:['DISPLAY_RIGHTS_NOT_CONFIRMED']}}}).href,undefined);
 assert.equal(marketDataState({record:{projection:'REDACTED'}}).href,'/account');
 assert.equal(marketDataState({error:{code:'MEMBERSHIP_REQUIRED'}}).href,'/account');
});
test('stale and unknown data remain distinct and missing times are never synthesized',()=>{
 for(const [freshness,kind] of [['STALE','stale'],['UNKNOWN','unknown']])assert.equal(marketDataState({record:{status:{availability:'AVAILABLE',freshness}}}).kind,kind);
 assert.equal(sourceTime(null),'ต้นทางไม่ระบุ');assert.equal(sourceTime('invalid'),'ต้นทางไม่ระบุ');
 assert.equal(marketDataState({error:{code:'PROVIDER_UNAVAILABLE'}}).retry,true);
});
