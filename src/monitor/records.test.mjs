import test from 'node:test';
import assert from 'node:assert/strict';
import {forwardEvents} from './view.mjs';
import {tradeReference,eventLabel,eventSpeech,countedTrade} from './records.mjs';
import {summarize} from '../daytrade/engine.mjs';
import {createNotificationInbox} from '../auto-pick/notification-inbox.mjs';
const now=Date.parse('2026-10-15T15:00:00Z');
const trade={id:'committed-record',market:'us',symbol:'NTES',side:'SHORT',status:'CLOSED',publishedAt:now-1000,trigger:100,stop:106,entryTime:now/1000,plan:{entry:100,stop:105,target:90},exit:90,exitTime:now/1000+900,reason:'TP',netR:2};
test('entry / exit / stats share one record, immutable plan publication, side and reference price',()=>{
  const e=forwardEvents([trade]);assert.equal(e.length,3);
  for(const event of e)assert.deepEqual(tradeReference(event),{ledger:'daytrade',market:'us',tradeId:trade.id});
  assert.equal(e[0].stopLoss,106);assert.equal(e[0].tp1,null);assert.equal(e[1].price,trade.plan.entry);assert.equal(e[2].price,trade.exit);
  assert.ok(eventSpeech(e[1]).includes('SHORT'));assert.equal(eventLabel(e[2]),'ถึง TP · ปิดไม้');
  assert.equal(summarize([trade]).closed,1);assert.equal(countedTrade(trade,'daytrade'),true);
});
test('review without an exit and expired pending plans emit their actual observation time, never a win',()=>{
  const review={...trade,status:'REVIEW',exitTime:null,netR:null,reason:'AMBIGUOUS_TP_SL',reviewedAt:now+900000,reviewBarTime:now/1000};
  const expired={...trade,id:'expired',status:'EXPIRED',entryTime:null,plan:null,exitTime:null,netR:null,expiredAt:now+800000};
  const records=[review,expired],e=forwardEvents(records);
  assert.equal(e.find(e=>e.type==='AMBIGUOUS').priceAt,new Date(now+900000).toISOString());
  assert.equal(e.find(e=>e.type==='EXPIRED').price,null);assert.equal(summarize(records).closed,0);assert.equal(summarize(records).review,1);
  assert.equal(countedTrade(review,'daytrade'),false);
  const old={...review,reviewedAt:null};assert.equal(forwardEvents([old]).some(e=>e.type==='AMBIGUOUS'),false,'cannot invent an old review timestamp');
});
test('mute, repeat snapshot and durable reload leave one closed trade and unchanged net result',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},make=()=>createNotificationInbox({scope:'daytrade:fixture',owner:'test',storage,now:()=>now+1000000});
  const first=make(),records=[trade];await first.receiveSnapshot([]);await first.receiveSnapshot(forwardEvents(records));
  for(let e;(e=await first.claim());){await first.voice(e.id,'muted');await first.dismiss(e.id);}
  const before=summarize(records),reload=make();await reload.receiveSnapshot(forwardEvents(records));
  assert.equal((await reload.history()).length,3);assert.equal((await reload.snapshot()).pending,0);assert.deepEqual(summarize(records),before);assert.equal(before.closed,1);assert.equal(before.netR,2);
});
test('cached legacy references resolve exact ledger, partial Swing TP1 stays outside closed stats, news stays unlinked',()=>{
  assert.deepEqual(tradeReference({id:'old:entry',mode:'daytrade',market:'thai'}),{ledger:'daytrade',market:'thai',tradeId:'old'});
  assert.deepEqual(tradeReference({signalId:'swing-record',mode:'breakout',market:'thai'}),{ledger:'swing',market:'thai',tradeId:'swing-record'});
  assert.equal(tradeReference({pickId:'legacy',market:'thai'}),null);assert.equal(tradeReference({ledger:'news',type:'NEWS',market:'us'}),null);
  assert.equal(eventLabel({type:'TARGET',signalId:'swing-record'}),'ถึง TP1 · ปิดบางส่วน');
  assert.equal(countedTrade({status:'RUNNER',netR:1},'swing'),false);assert.equal(countedTrade({status:'CLOSED',netR:1},'swing'),true);
});
