import test from 'node:test';import assert from 'node:assert/strict';
import {buildDecisionBrief,sizeReferencePlan,defaultDecisionLot} from './decision-brief.mjs';
const plan={signalEligible:true,entry:100,entryBasis:101,stopLoss:97,minimumTarget:110,netRiskPerUnit:4.5,stopPercent:4,minimumNetRewardRisk:2};
const row={market:'thai',symbol:'PTT',state:'WAIT',trendD1:'up',relativeVolume:1.2,matched:{breakout:false,pullback:false},mode:'breakout',plan};
test('DR one-unit lots keep small budgets usable while equity sizing retains an editable default',()=>{
 const budget={capital:1000,riskBudget:50};assert.equal(sizeReferencePlan(plan,{...budget,lotSize:defaultDecisionLot('dr')}).quantity,8);assert.equal(sizeReferencePlan(plan,{...budget,lotSize:defaultDecisionLot('thai')}).quantity,0);
});
test('decision brief counts distinct symbols and promotes the better verified setup without inflating the list',()=>{
 const rows=[row,{...row,mode:'pullback',state:'PASS',matched:{pullback:true}},...Array.from({length:8},(_,i)=>({...row,symbol:`S${i}`})),{...row,symbol:'BAD',state:'REJECT',plan:null,reasons:['STRUCTURAL_STOP_EXCEEDS_8_PERCENT']},{...row,symbol:'NO_DATA',state:'UNAVAILABLE',plan:null,reasons:['SCAN_STALE']}];
 const b=buildDecisionBrief(rows);assert.equal(b.totalSymbols,11);assert.deepEqual(b.counts,{ready:1,waiting:8,avoid:1,unavailable:1});assert.equal(b.items.length,5);assert.equal(b.items[0].symbol,'PTT');assert.equal(b.items[0].mode,'pullback');assert.equal(b.items[0].checks.every(c=>c.passed),true);assert.equal(b.excluded[1].reason,'ผลสแกนเกินเวลาที่กำหนด');assert.equal(rows[0].category,undefined);
});
test('downtrend, blocked risk and missing data are never relabelled as an attractive watch candidate',()=>{
 const b=buildDecisionBrief([{...row,symbol:'DOWN',trendD1:'down'},{...row,symbol:'RISK',state:'REJECT',plan:{...plan,signalEligible:false}},{...row,symbol:'STALE',state:'UNAVAILABLE'}]);assert.equal(b.items.length,0);assert.equal(b.counts.avoid,2);assert.equal(b.counts.unavailable,1);assert.equal(buildDecisionBrief([]).items.length,0);
});
test('risk sizing respects both capital and net cost risk, and permits equal 50% partial exits',()=>{
 const s=sizeReferencePlan(plan,{capital:50000,riskBudget:1000,lotSize:100});assert.equal(s.quantity,200);assert.equal(s.estimatedCapital,20200);assert.equal(s.estimatedRisk,900);assert.equal(s.tp1Quantity,100);assert.equal(s.runnerQuantity,100);
 const cash=sizeReferencePlan(plan,{capital:10000,riskBudget:1000,lotSize:1});assert.equal(cash.quantity,98);assert.ok(cash.estimatedCapital<=10000);assert.ok(cash.estimatedRisk<=1000);
 assert.equal(sizeReferencePlan(plan,{capital:10000,riskBudget:500,lotSize:100}).quantity,0);
 for(const bad of [0,-1,NaN,Infinity])assert.equal(sizeReferencePlan(plan,{capital:10000,riskBudget:bad}),null);
 assert.equal(sizeReferencePlan(plan,{capital:100,riskBudget:101}),null);assert.equal(sizeReferencePlan({...plan,signalEligible:false},{capital:10000,riskBudget:500}),null);assert.equal(sizeReferencePlan(plan,{capital:1e300,riskBudget:1e299,lotSize:100}),null);
});
