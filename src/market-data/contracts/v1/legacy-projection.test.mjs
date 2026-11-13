import test from 'node:test';
import assert from 'node:assert/strict';
import {projectLedger} from './legacy-ledger.mjs';
import {createCanonicalHandler} from './handlers.mjs';
const rows=Array.from({length:20},(_,i)=>({key:`swing:${i}`,id:String(i),market:'thai',symbol:`S${i%4}`,ledger:'swing',strategy:i%2?'swing':'orb',status:i%2?'CLOSED':'OPEN',publishedAt:new Date(Date.UTC(2026,9,26,0,0,20-i)).toISOString(),entryPrice:100,exitPrice:200,plan:{entry:100,stopLoss:90},outcome:{returnPercent:100},secret:'DO_NOT_SERIALIZE'}));
test('ledger caps identities before strategy, status, page and record focus; strips raw plans and unverified performance',()=>{
 for(const cap of [3,5,8]){
  const scope={market:'thai',cap,symbols:['S0','S1','S2','S3']};
  const baseline=projectLedger([{rows}],scope);
  assert.equal(baseline.signals.length,cap);assert.equal(baseline.total,cap);
  assert.equal(baseline.summary.winRate,null);assert.deepEqual(baseline.recentTrades,[]);
  assert.ok(baseline.signals.every(r=>r.plan===null&&r.outcome===null));assert.ok(!JSON.stringify(baseline).includes('DO_NOT_SERIALIZE'));
  for(const query of [{page:2},{tradeKey:'swing:19'},{status:'CLOSED'},{strategy:'swing'},{scope:'closed'}]){
   const data=projectLedger([{rows}],{...scope,query});
   assert.ok(data.signals.every(r=>baseline.signals.some(b=>b.key===r.key)));
   assert.equal(data.selectedKey,null);assert.ok(data.total<=cap);
   assert.equal(data.summary.winRate,null);
  }
 }
});
test('legacy scan views consume only capped canonical rows and cannot revive unverified signals',async()=>{
 for(const market of ['thai','dr','us','tfex','forex'])for(const [planId,cap] of [['starter',3],['pro',5],['ultimate',8]])for(const legacyView of ['swing','daytrade','auto-pick']){
  const handler=createCanonicalHandler({market,legacyView,currentMember:async()=>({id:'fixture'}),membershipFor:()=>({tier:'subscriber',planId}),loadInputs:async()=>Array.from({length:20},(_,i)=>({market,symbol:'S'+i,instrumentId:'FIXTURE:'+i,dataKind:{thai:'SCANNER_CANDIDATE',dr:'DR_BRIDGE',us:'EQUITY_EOD',tfex:'FUTURES_CANDIDATE',forex:'SCAN_CANDIDATE'}[market],providerId:'unknown',providerState:'UNAVAILABLE',data:{price:111,entry:222,secret:'DO_NOT_SERIALIZE'}}))});
  const response=await handler(new Request('https://example.invalid/api/scan?diagnostic=1&cap=99&tier=ULTIMATE'));
  assert.equal(response.status,200);const value=await response.json();
  if(legacyView!=='auto-pick')assert.equal(value.notificationScope.split(':')[1],'fixture');
  assert.ok((value.rows??value.universe??[]).length<=cap);assert.ok(!JSON.stringify(value).includes('DO_NOT_SERIALIZE'));
  assert.deepEqual(value.signals??value.activeForward,legacyView==='daytrade'?[]:[]);
  const hidden=await (await handler(new Request('https://example.invalid/api/scan?q=S19'))).json();
  assert.equal((hidden.rows??hidden.universe??[]).length,0);
 }
});
