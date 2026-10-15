import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateViews, startReferenceSignal, advanceReferenceSignal, inspectSignalBars, summarizeSignals, tickPrice, signalPlan, continuousSessionSlot, referenceMark } from './model.mjs';
import { thaiResearchCosts } from '../analysis/swing-standard.mjs';
import { aggregateSession4h } from './data.mjs';
const epoch=Date.parse('2026-10-15T03:00:00Z')/1000;
const context={market:'thai',symbol:'PTT',instrumentId:'SET100:PTT',name:'PTT',status:'AVAILABLE',price:100,swingLow:98,atr:1,resistanceLevels:[],relativeVolume:1.2,trendD1:'up',matched:{breakout:true,pullback:false},latest4hTime:epoch-14400-900,priceAt:new Date((epoch-900)*1000).toISOString()};
const costs=thaiResearchCosts();
const bar=(time,open=100,high=101,low=99,close=100)=>({time,open,high,low,close,volume:10000});
const begin=()=>startReferenceSignal(candidateViews(context,costs)[0],'standard',epoch*1000);
const step=(s,b,snapshot=context)=>advanceReferenceSignal(s,b,snapshot,(b.at(-1).time+1800)*1000);
test('Swing candidates enforce structural max stop, net 2R, trend, RVOL and explicit US costs',()=>{
 const pass=candidateViews(context,costs)[0];assert.equal(pass.state,'PASS');assert.equal(pass.plan.stopLoss,97);
 assert.equal(candidateViews({...context,relativeVolume:0.8},costs)[0].state,'WAIT');
 assert.equal(candidateViews({...context,swingLow:90},costs)[0].state,'REJECT');
 assert.equal(candidateViews({...context,market:'us'},null)[0].reasons[0],'COSTS_REQUIRED');
 assert.equal(pass.plan.tradeAllowed,false);assert.equal(pass.plan.liveEligible,false);
 assert.equal(candidateViews(context,costs)[1].state,'WAIT');
});
test('tick rounding evaluates the destination price band independently; targets retain net 2R',()=>{
 assert.equal(tickPrice(99.9,'thai',true),100);assert.equal(tickPrice(100.1,'thai',true),100.5);
 const plan=signalPlan({...context,price:99,swingLow:97,atr:0.2},99,costs);
 assert.equal(plan.targets[0].price%0.5,0);assert.ok(plan.targets[0].price>100);
 const r=(plan.targets[0].price*(1-plan.friction.slip)*(1-plan.friction.fee)-plan.entryBasis)/plan.netRiskPerUnit;
 assert.ok(r>=2);
});
test('no pre-publication bar becomes an entry; confirmed entry records event availability separately',()=>{
 let s=begin();s=step(s,[bar(epoch-900)]).signal;assert.equal(s.status,'WAITING');
 const {signal,events}=step(s,[bar(epoch)]);assert.equal(signal.status,'OPEN');assert.equal(events[0].type,'ENTRY');
 assert.equal(signal.enteredAt,new Date((epoch+900)*1000).toISOString());assert.equal(signal.confirmedAt,new Date((epoch+1800)*1000).toISOString());
 assert.equal(signal.fills.length,0);
});
test('TP1 half plus BE runner is around 1R as one closed signal, never two wins',()=>{
 let s=step(begin(),[bar(epoch)]).signal;const tp=s.plan.minimumTarget;
 s=step(s,[bar(epoch+900,tp+1,tp+2,102,tp+1)]).signal;
 assert.equal(s.status,'RUNNER');assert.equal(s.stopState,'BREAKEVEN');assert.equal(s.remainingFraction,0.5);
 const mark=referenceMark({...s,latestPrice:s.plan.breakEvenStop});assert.ok(mark.markNetR>=1&&mark.markNetR<1.2);
 s=step(s,[bar(epoch+1800,101,102,99,100)]).signal;
 assert.equal(s.status,'CLOSED');assert.ok(s.netR>=1&&s.netR<1.1);
 const stats=summarizeSignals([s]);assert.equal(stats.closed,1);assert.equal(stats.wins,1);assert.equal(stats.expectancyR,s.netR);
});
test('an unresolved stop/target collision is REVIEW and excluded; a gap stop retains actual adverse opening reference',()=>{
 const open=step(begin(),[bar(epoch)]).signal;
 const collision=step(open,[bar(epoch+900,100,open.plan.minimumTarget+1,96,101)]).signal;
 assert.equal(collision.status,'REVIEW');assert.equal(summarizeSignals([collision]).closed,0);
 const gap=step(open,[bar(epoch+900,90,92,89,91)]).signal;assert.equal(gap.status,'STOP');assert.ok(gap.netR < -1);
});
test('zero-volume buckets cannot confirm an entry or fabricate a stop fill',()=>{
 const empty={...bar(epoch),volume:0};const waiting=step(begin(),[empty]);assert.equal(waiting.signal.status,'WAITING');assert.equal(waiting.events.length,0);
 const open=step(begin(),[bar(epoch)]).signal;
 const noTrade=step(open,[{...bar(epoch+900,90,92,89,91),volume:0}]);assert.equal(noTrade.signal.status,'OPEN');assert.equal(noTrade.signal.fills.length,0);
});
test('missed first monitoring slot or later missing regular-session bars cannot yield a fabricated outcome',()=>{
 const missed=step(begin(),[bar(epoch+1800)]);assert.equal(missed.signal.status,'REVIEW');assert.equal(missed.events[0].type,'DATA_GAP');
 const open=step(begin(),[bar(epoch)]).signal;
 assert.equal(step(open,[bar(epoch+1800)]).signal.status,'REVIEW');
 assert.equal(continuousSessionSlot(Date.parse('2026-10-15T06:00:00Z')/1000,'thai'),false);
 assert.equal(continuousSessionSlot(Date.parse('2026-10-16T18:00:00Z')/1000,'dr'),true);
});
test('4H aggregation requires every constituent; partial session tails are labelled actual bars, not filled hours',()=>{
 const start=Date.parse('2026-10-14T13:30:00Z')/1000;
 const hours=Array.from({length:7},(_,i)=>bar(start+i*3600));
 const result=aggregateSession4h(hours,'us');assert.equal(result.length,2);assert.equal(result[0].volume,40000);assert.equal(result[1].volume,30000);
 assert.equal(aggregateSession4h(hours.filter((_,i)=>i!==2),'us').length,1);
 assert.equal(result[0].time,start);
});
test('runner trail uses only a 4H structure available before that execution bar; near-stop alert is once per stop',()=>{
 let s=step(begin(),[bar(epoch)]).signal;const target=s.plan.minimumTarget;
 s=step(s,[bar(epoch+900,target+1,target+2,102,target+1)]).signal;
 s=step(s,[bar(epoch+1800,103,104,102.8,103)],{...context,swingLow:103,atr:0.5,latest4hTime:epoch+1800}).signal;
 assert.equal(s.stopState,'BREAKEVEN');
 const trail=step(s,[bar(epoch+2700,103,104,102.8,103)],{...context,swingLow:103,atr:0.5,latest4hTime:epoch+2700-15300});
 assert.equal(trail.signal.stop,102.5);assert.equal(trail.signal.stopState,'TRAIL');assert.ok(trail.events.some(e=>e.type==='STOP_MOVED'));
 let near=step(begin(),[bar(epoch)]).signal;
 const first=step(near,[bar(epoch+900,97.5,98,97.2,97.4)]);assert.equal(first.events.filter(e=>e.type==='NEAR_STOP').length,1);
 const second=step(first.signal,[bar(epoch+1800,97.5,98,97.2,97.4)]);assert.equal(second.events.filter(e=>e.type==='NEAR_STOP').length,0);
});
test('indicator snapshots are causal: future candles do not leak into a closed 4H candidate',()=>{
 const daily=Array.from({length:100},(_,i)=>({...bar(0,99+i*.02,100+i*.02,98+i*.02,99.5+i*.02),time:new Date(Date.UTC(2026,5,i+1)).toISOString().slice(0,10)}));
 const four=Array.from({length:80},(_,i)=>bar(epoch-(80-i)*14400,100+Math.sin(i),101+Math.sin(i),99+Math.sin(i),100+Math.sin(i)));
 const now=(four[65].time+15300)*1000;
 const a=inspectSignalBars({id:'thai',symbol:'PTT'},daily,four,now);
 const b=inspectSignalBars({id:'thai',symbol:'PTT'},daily,four.slice(0,66),now);
 assert.deepEqual(a,b);assert.equal(a.latest4hTime,four[65].time);
});
