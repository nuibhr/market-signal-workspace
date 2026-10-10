import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceThaiOrbPick}from './thai-orb.mjs';
import {announcementFor,SPOKEN_TYPES}from './announcements.mjs';
import {advanceUsEodPick}from './us-engine.mjs';
import {advanceDrOrbPick}from './dr-orb.mjs';
import {customerSummary}from '../analysis/customer-summary.mjs';
const time=s=>Date.parse(`2026-10-01T${s}:00+07:00`)/1000;
const opening={time:time('10:00'),open:100,high:100.1,low:99.8,close:100,volume:10000};
const confirm={time:time('10:15'),open:100.1,high:100.3,low:100,close:100.2,volume:10000};
const plan={setupType:'OPENING_RANGE_BREAKOUT',tradeAllowed:true,entry:100.1,stopLoss:98.5,tp1:104,referenceCandles:{fifteenMinuteTimestamp:opening.time},features:{minEntryBarValue:500000}};
const pick={symbol:'PTT',market:'thai',sessionDay:'2026-10-01',publishedAt:new Date(time('10:15')*1000).toISOString(),status:'WAITING_FOR_ENTRY',plan};
test('closed-bar entry -> spoken announcement -> target',()=>{
 const entry=advanceThaiOrbPick(pick,[opening,confirm],time('10:30')*1000);assert.equal(entry.pick.status,'OPEN');assert.equal(entry.pick.entryPrice,100.2);assert.equal(entry.events[0].type,'ENTRY');
 const spoken=announcementFor({...entry.events[0],market:'thai',symbol:'PTT'});assert.ok(SPOKEN_TYPES.has('ENTRY'));assert.match(spoken.text,/100.2/);
 const target={time:time('10:30'),open:100.2,low:100.1,high:104.1,close:104,volume:10000};
 const exit=advanceThaiOrbPick(entry.pick,[opening,confirm,target],time('10:45')*1000);assert.equal(exit.pick.status,'TARGET');assert.equal(exit.pick.exitPrice,104);
});
test('open candle cannot trigger entry',()=>{assert.equal(advanceThaiOrbPick(pick,[opening,confirm],time('10:29')*1000).pick.status,'WAITING_FOR_ENTRY');});
test('missed monitoring is REVIEW, never a claimed no-entry',()=>{const result=advanceThaiOrbPick(pick,[opening,confirm],time('14:30')*1000);assert.equal(result.pick.status,'REVIEW');assert.equal(result.events.at(-1).type,'DATA_GAP');});
test('same bar target and stop is excluded from win rate',()=>{const entered=advanceThaiOrbPick(pick,[opening,confirm],time('10:30')*1000).pick;const bar={time:time('10:30'),open:100.2,high:105,low:98,close:101,volume:10000};assert.equal(advanceThaiOrbPick(entered,[opening,confirm,bar],time('10:45')*1000).pick.status,'AMBIGUOUS');});
test('unavailable data has no technical score',()=>{assert.equal(customerSummary(null).score,null);});

test('a later fresh check preserves the missed-monitoring flag',()=>{
 const waiting={...pick,plan:{...plan,entry:110},status:'WAITING_FOR_ENTRY'};
 const later={...confirm,time:time('10:45')};
 const result=advanceThaiOrbPick(waiting,[opening,confirm,later],time('11:00')*1000);
 assert.equal(result.pick.plan.monitoringIncomplete,true);
 assert.ok(result.pick.plan.latestEntryCheck);
});

test('stop announcement includes the symbol and reference price',()=>{
 const a=announcementFor({type:'STOP',market:'thai',symbol:'PTT',price:98.5});
 assert.match(a.text,/พีทีที/);assert.match(a.text,/98.5/);assert.ok(SPOKEN_TYPES.has('STOP'));
});
test('DR entry speech includes target and stop',()=>{
 const a=announcementFor({type:'ENTRY',market:'dr',symbol:'NVDA80',price:39,tp1:40.5,stopLoss:38.25});
 assert.match(a.text,/เป้าหมาย 40.5/);assert.match(a.text,/จุดตัดขาดทุน 38.25/);
});

test('US D1 watch expires after the next trading day without confirmation',()=>{
 const us={status:'WAITING_FOR_ENTRY',sessionDay:'2026-09-29',plan:{tradeAllowed:true,timeframe:'1d',entry:101,stopLoss:98,tp1:108,trigger:{price:101},referenceCandles:{dailyDay:'2026-09-29'},maxEntryBars:7}};
 const bars=[{time:'2026-09-29',open:100,high:100,low:99,close:100},{time:'2026-09-30',open:100,high:100,low:99,close:100}];
 assert.equal(advanceUsEodPick(us,bars).pick.status,'EXPIRED');
});

test('Thai waiting plan with a fresh final bar but missing intervening bars needs review',()=>{
 const waiting={...pick,plan:{...plan,entry:110}};
 const last={...confirm,time:time('11:15')};
 const result=advanceThaiOrbPick(waiting,[opening,last],time('11:30')*1000);
 assert.equal(result.pick.status,'REVIEW');
 assert.equal(result.events.at(-1).type,'DATA_GAP');
});

test('DR waiting plan cannot claim no entry when only the final monitoring bar exists',()=>{
 const waiting={...pick,market:'dr',publishedAt:new Date(time('10:30')*1000).toISOString(),plan:{...plan,
  setupType:'DR_ORB_15M',entry:110,features:{session:'day',openingStart:time('10:00'),openingEnd:time('10:30'),
   entryEnd:time('11:30'),sessionEnd:time('12:30'),minEntryBarValue:100000,maxChase:110}}};
 const last={...confirm,time:time('11:15')};
 const result=advanceDrOrbPick(waiting,[opening,last],{marketStatus:'day',price:100.2},time('11:30')*1000);
 assert.equal(result.pick.status,'REVIEW');
 assert.equal(result.events.at(-1).type,'DATA_GAP');
});

test('complete timely monitoring still expires a Thai plan that never meets entry conditions',()=>{
 let waiting={...pick,plan:{...plan,entry:110}};
 const bars=[opening];
 for(let index=1;index<=5;index++){
  const bar={...confirm,time:opening.time+index*900};bars.push(bar);
  waiting=advanceThaiOrbPick(waiting,bars,(bar.time+900)*1000).pick;
 }
 assert.equal(waiting.status,'EXPIRED');
 assert.equal(Boolean(waiting.plan.monitoringIncomplete),false);
});
