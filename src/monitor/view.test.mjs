import test from 'node:test';
import assert from 'node:assert/strict';
import {monitorRow,filterRows,forwardEvents} from './view.mjs';
import {createNotificationInbox} from '../auto-pick/notification-inbox.mjs';
import {createSignalSpeaker} from '../auto-pick/speech.mjs';
const now=Date.parse('2026-10-15T15:00:00Z');
const row={symbol:'NTES',name:'NETEASE INC-ADR',kind:'stock_cfd',status:'READY',price:99,latestBar:now/1000-900,receivedAt:now-1000,bars:100,stale:false,side:null,monitorPlan:{entry:100,side:'LONG',status:'WAITING'}};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
const box=(scope='fixture',s=storage(),options={})=>createNotificationInbox({scope,storage:s,owner:'test-only',now:()=>now,historyLimit:1000,...options});
const trade=(id='a',market='us',symbol='NTES')=>({id,market,symbol,side:'LONG',status:'OPEN',publishedAt:now-1000,trigger:100,entryTime:now/1000,plan:{entry:100,stop:95,target:110}});
test('NTES below, at and past entry level preserves confirmation requirement',()=>{
  assert.equal(monitorRow(row,'us','connected',now).condition,'รอแท่งเข้า');
  for(const price of [100,101]){
    const r=monitorRow({...row,price},'us','connected',now);assert.equal(r.touched,true);assert.equal(r.met,false);assert.equal(r.condition,'แตะระดับราคา · รอเงื่อนไขครบ');
  }
  assert.equal(monitorRow({...row,side:'LONG'},'us','connected',now).met,true);
});
test('quote freshness is distinct from evaluation bars; disconnected / unchanged old tick cannot confirm',()=>{
  const quote={price:101,time:now/1000,received_at:new Date(now).toISOString()};
  const r=monitorRow({...row,quote},'us','connected',now);assert.equal(r.quality,'Real-time');assert.equal(r.price,101);assert.equal(r.evaluationPrice,99);assert.equal(r.met,false);
  const stale=monitorRow({...row,quote,side:'LONG',stale:true,latestBar:now/1000-7200},'us','connected',now);assert.equal(stale.quality,'Real-time');assert.equal(stale.abnormal,true);assert.equal(stale.met,false);
  assert.equal(monitorRow({...row,quote,side:'LONG'},'us','stale',now).met,false);
  assert.equal(monitorRow({...row,quote},'us','connected',now+31000).quality,'Delayed');
  assert.equal(monitorRow({...row,quote:{...quote,time:now/1000+1}},'us','connected',now).quality,'Delayed');
});
test('native closed bars are Delayed, missing is Unavailable, old is Stale',()=>{
  assert.equal(monitorRow(row,'thai','server',now).quality,'Delayed');
  assert.equal(monitorRow({...row,price:null,latestBar:null},'thai','server',now).quality,'Unavailable');
  const s=monitorRow({...row,side:'LONG',latestBar:now/1000-7200},'thai','server',now);assert.equal(s.quality,'Stale');assert.equal(s.met,false);
  assert.equal(monitorRow({...row,status:'UNAVAILABLE'},'us','connected',now).met,false);
});
test('short target comparison, no target and zero target distance remain explicit',()=>{
  const short=monitorRow({...row,price:99,monitorPlan:{...row.monitorPlan,side:'SHORT'}},'us','connected',now);assert.equal(short.touched,true);
  assert.equal(monitorRow({...row,monitorPlan:null},'us','connected',now).distance,null);
  assert.equal(monitorRow({...row,monitorPlan:{entry:0}},'us','connected',now).distance,null);
});
test('group/name filters and stable priority do not fabricate a near threshold',()=>{
  const rows=[monitorRow(row,'us','connected',now),monitorRow({...row,symbol:'PTT',name:'PTT',side:'LONG'},'thai','server',now),monitorRow({...row,symbol:'GLD',name:'SPDR Gold',kind:'etf_cfd'},'us','connected',now)];
  assert.equal(filterRows(rows)[0].symbol,'PTT');assert.equal(filterRows(rows,{query:'netease'})[0].symbol,'NTES');assert.equal(filterRows(rows,{group:'etf'}).length,1);assert.equal(filterRows(rows,{status:'near'}).length,0);
  const sortRows=[
    {symbol:'AAPL',name:'Apple',market:'us',met:false,ranking:{score:80},changePercent:2.5,atr:1.2},
    {symbol:'MSFT',name:'Microsoft',market:'us',met:false,ranking:{score:95},changePercent:1.1,atr:2.4},
    {symbol:'AMZN',name:'Amazon',market:'us',met:false,ranking:{score:60},changePercent:3.8,atr:0.8},
  ];
  assert.equal(filterRows(sortRows,{sortBy:'score_desc'})[0].symbol,'MSFT');
  assert.equal(filterRows(sortRows,{sortBy:'symbol_asc'})[0].symbol,'AAPL');
  assert.equal(filterRows(sortRows,{sortBy:'change_desc'})[0].symbol,'AMZN');
  assert.equal(filterRows(sortRows,{sortBy:'atr_desc'})[0].symbol,'MSFT');
});
test('projection preserves entry and exit between polls; repeated input stays immutable',()=>{
  const t={...trade(),status:'CLOSED',exitTime:now/1000+900,exit:110,reason:'TP'};const before=structuredClone(t),e=forwardEvents([t]);assert.deepEqual(t,before);assert.deepEqual(e.map(e=>e.type),['PICK_READY','ENTRY','TARGET']);assert.equal(new Set(e.map(e=>e.id)).size,3);assert.equal(e[1].price,100);
});
test('all five groups can enter simultaneously; mute retains every event and browser queue',async()=>{
  const b=box();await b.receiveSnapshot([]);
  const events=forwardEvents(['us','thai','dr','tfex','forex'].map((m,i)=>trade(String(i),m,m==='us'?'NTES':`fixture-${m}`)));
  assert.equal(await b.receiveSnapshot(events),true);
  for(let e; (e=await b.claim(true));){await b.displayed(e.id);await b.voice(e.id,'muted');await b.dismiss(e.id);}
  assert.equal((await b.history()).length,10);assert.ok((await b.history()).every(e=>e.deliveryVoice==='muted'));
  assert.equal(await b.receiveSnapshot(events),true);assert.equal((await b.snapshot()).pending,0);
});
test('refresh uses durable snapshot IDs; same price re-entry with new engine ID alerts again',async()=>{
  const s=storage(),first=box('same-member',s);await first.receiveSnapshot([]);const events=forwardEvents([trade('first')]);await first.receiveSnapshot(events);
  for(let e;(e=await first.claim(true));)await first.dismiss(e.id);
  const reload=box('same-member',s);await reload.receiveSnapshot(events);assert.equal((await reload.snapshot()).pending,0);
  await reload.receiveSnapshot([...events,...forwardEvents([trade('second')])]);assert.equal((await reload.snapshot()).pending,2);
  const other=box('other-member',s);await other.receiveSnapshot(events);assert.equal((await other.snapshot()).pending,0);
});
test('first visit is silent history, hidden tab does not claim, overflow retries without marking received',async()=>{
  const b=box(),existing=forwardEvents([trade()]);await b.receiveSnapshot(existing);assert.equal((await b.snapshot()).pending,0);assert.equal((await b.history()).length,2);
  const many=Array.from({length:501},(_,i)=>({...existing[1],id:`many:${i}`}));assert.equal(await b.receiveSnapshot([...existing,...many]),false);assert.equal((await b.snapshot()).pending,500);
  assert.equal(await b.claim(false),null);for(let e;(e=await b.claim(true));)await b.dismiss(e.id);
  assert.equal(await b.receiveSnapshot([...existing,...many]),true);assert.equal((await b.snapshot()).pending,1);
});
test('audio callback updates retained event only after browser completion; blocked never becomes ended',async()=>{
  const b=box();await b.receiveSnapshot([]);await b.receiveSnapshot(forwardEvents([trade()]));const e=await b.claim(true);await b.voice(e.id,'attempted');await b.dismiss(e.id);await b.voice(e.id,'blocked');assert.equal((await b.history()).find(x=>x.id===e.id).deliveryVoice,'blocked');
  const states=[],utterances=[];class Utterance{constructor(text){this.text=text;}}
  const speaker=createSignalSpeaker({SpeechSynthesisUtterance:Utterance,speechSynthesis:{cancel(){},getVoices(){return[];},speak(u){utterances.push(u);}}},s=>states.push(s));speaker.play('NTES');assert.deepEqual(states,['starting']);utterances[0].onerror({error:'not-allowed'});assert.equal(states.at(-1),'blocked');assert.ok(!states.includes('speaking'));
});
test('storage failure is surfaced rather than claiming durable refresh dedupe',async()=>{
  let failed=false;const b=box('fixture',{getItem(){throw Error();},setItem(){throw Error();}},{onPersistenceError:()=>failed=true});await b.receiveSnapshot([]);assert.equal(failed,true);assert.equal((await b.snapshot()).durable,false);
});
