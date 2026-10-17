import test from 'node:test';
import assert from 'node:assert/strict';
import {newsEvents} from './news.mjs';
import {soundPreference,saveSoundPreference} from './preferences.mjs';
import {createNotificationInbox} from '../auto-pick/notification-inbox.mjs';
import {eventSpeech} from './records.mjs';
const now=Date.parse('2026-10-15T15:00:00Z');
const article={id:'provider-job',title:'Real source fixture headline',url:'https://example.org/story',publishedAt:new Date(now-10000).toISOString(),source:'Fixture publisher',newsTypes:['breaking_news'],impactScore:2,entities:['NTES']};
const feed=a=>({markets:[{id:'us',label:'US',status:'available',articles:a}]});
test('new devices default to sound on; explicit mute survives reload and unavailable storage defaults on',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  assert.equal(soundPreference(storage),true);saveSoundPreference(storage,false);assert.equal(soundPreference(storage),false);saveSoundPreference(storage,true);assert.equal(soundPreference(storage),true);
  assert.equal(soundPreference({getItem(){throw Error();}}),true);
});
test('news uses source breaking flags or high importance, filters stale / old / future / unsafe stories',()=>{
  assert.equal(newsEvents(feed([article]),now)[0].breaking,true);
  assert.equal(newsEvents(feed([article,{...article,id:'duplicate-scan-job'}]),now).length,1);
  const important={...article,newsTypes:[],impactScore:4};assert.equal(newsEvents(feed([important]),now)[0].breaking,false);
  for(const a of [{...important,impactScore:3},{...article,publishedAt:null},{...article,publishedAt:new Date(now+1).toISOString()},{...article,publishedAt:new Date(now-1800000).toISOString()},{...article,url:'javascript:alert(1)'}])assert.equal(newsEvents(feed([a]),now).length,0);
  assert.equal(newsEvents({markets:[{...feed([article]).markets[0],status:'stale'}]},now).length,0);
  assert.ok(eventSpeech(newsEvents(feed([article]),now)[0]).includes(article.title));
});
test('first visit does not read old news; a newly scanned story alerts once across job IDs and reloads',async()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},make=()=>createNotificationInbox({scope:'news:public:fixture',owner:'test',storage,now:()=>now});
  const box=make(),initial=newsEvents(feed([article]),now);await box.receiveSnapshot(initial);assert.equal((await box.snapshot()).pending,0);
  const next={...article,id:'new-job',url:'https://example.org/second?utm_source=scan'};await box.receiveSnapshot(newsEvents(feed([article,next]),now));assert.equal((await box.snapshot()).pending,1);
  const event=await box.claim();assert.equal(event.type,'NEWS');await box.voice(event.id,'ended');await box.dismiss(event.id);
  const reload=make();await reload.receiveSnapshot(newsEvents(feed([{...next,id:'changed-job',url:'https://example.org/second?utm_source=another'}]),now));assert.equal((await reload.snapshot()).pending,0);assert.equal((await reload.history()).length,2);
});
test('news API honors existing rights/config gates and a shared 60-second cache without changing normal news limit',async()=>{
  const priorFetch=globalThis.fetch,priorEnv={NODE_ENV:process.env.NODE_ENV,MARKETDX_API_KEY:process.env.MARKETDX_API_KEY,MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED:process.env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED};
  try{
    const {GET}=await import('../app/api/news/route.js');process.env.NODE_ENV='production';delete process.env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED;
    assert.equal((await GET(new Request('https://example.org/api/news'))).status,503);
    process.env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED='true';delete process.env.MARKETDX_API_KEY;
    assert.equal((await (await GET()).json()).code,'MARKETDX_NOT_CONFIGURED');process.env.MARKETDX_API_KEY='fixture-key';
    const calls=[];globalThis.fetch=async url=>{calls.push(new URL(url).searchParams.get('limit'));return Response.json({results:[{url:article.url,title:article.title,published:article.publishedAt,is_breaking:true,source:article.source}]});};
    const r=await GET(new Request('https://example.org/api/news?alerts=1')),data=await r.json();assert.equal(data.pollingSeconds,60);assert.equal(data.markets[0].articles[0].breaking,true);
    await GET(new Request('https://example.org/api/news?alerts=1'));assert.deepEqual(calls,['30','30']);
    await GET(new Request('https://example.org/api/news'));assert.deepEqual(calls,['30','30','4','4']);
  }finally{globalThis.fetch=priorFetch;for(const [k,v] of Object.entries(priorEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
