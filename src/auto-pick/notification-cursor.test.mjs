import test from 'node:test';
import assert from 'node:assert/strict';
import {claimAnnouncements,EVENT_CURSOR_KEY} from './notification-cursor.mjs';
test('simultaneous tabs claim a new entry once; reload and hidden tabs do not repeat it',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  let tail=Promise.resolve();
  const locks={request:(_name,_options,action)=>{const task=tail.then(action);tail=task.catch(()=>{});return task;}};
  const old={id:'old',type:'PICK_READY',market:'us',createdAt:new Date().toISOString()};
  assert.deepEqual(await claimAnnouncements([old],{storage,locks}),[]);
  const entry={...old,id:'entry',type:'ENTRY'};
  const result=await Promise.all([claimAnnouncements([entry,old],{storage,locks}),claimAnnouncements([entry,old],{storage,locks})]);
  assert.equal(result.flat().length,1);assert.equal(result.flat()[0].id,'entry');
  assert.deepEqual(await claimAnnouncements([entry,old],{storage,locks}),[]);
  const target={...entry,id:'target',type:'TARGET'};
  assert.deepEqual(await claimAnnouncements([target,entry],{storage,locks,visible:()=>false}),[]);
  assert.equal(values.get(EVENT_CURSOR_KEY),'entry');
  assert.equal((await claimAnnouncements([target,entry],{storage,locks}))[0].type,'TARGET');
});
test('private browsing has a per-tab fallback; old alerts stay silent',async()=>{
  const memory={seen:'old'},storage={getItem(){throw Error();},setItem(){throw Error();}};
  const events=[{id:'new',type:'STOP',market:'us',createdAt:new Date().toISOString()},{id:'old'}];
  assert.equal((await claimAnnouncements(events,{memory,storage})).length,1);
  assert.deepEqual(await claimAnnouncements(events,{memory,storage}),[]);
  assert.deepEqual(await claimAnnouncements([{...events[0],id:'stale',createdAt:new Date(Date.now()-1800001).toISOString()},events[0]],{memory,storage}),[]);
});
