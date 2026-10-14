import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommunityWriter,sendCommunityMutation} from './writer.mjs';

const body={action:'send',kind:'room',channelId:'lounge',body:'Fixture message'};
const ok=()=>Response.json({ok:true});

test('a stalled request or response body releases the UI and aborts at the deadline',async()=>{
  for(const readingBody of [false,true]) {
    let signal;
    const outcome=await sendCommunityMutation(body,{timeoutMs:10,fetcher:async(_url,options)=>{
      signal=options.signal;
      if(readingBody)return {ok:true,json:()=>new Promise(()=>{})};
      return new Promise(()=>{});
    }});
    assert.equal(outcome.status,'uncertain');assert.equal(outcome.error,'REQUEST_TIMEOUT');assert.equal(signal.aborted,true);
  }
});

test('rapid double submit and retry keep a single operation until confirmation',async()=>{
  let release,ids=0,confirmed=0;
  const requests=[];
  const writer=createCommunityWriter({makeId:()=>`fixture-${++ids}`,onConfirmed:()=>confirmed++,fetcher:async(_url,options)=>{
    requests.push(options.body);
    if(requests.length===1)return new Promise(resolve=>{release=resolve;});
    return ok();
  }});
  const first=writer.write(body);
  assert.equal((await writer.write(body)).status,'ignored');
  assert.equal((await writer.retry()).status,'ignored');
  release(Response.json({error:'UNEXPECTED_ERROR'},{status:500}));
  await first;
  assert.equal(writer.snapshot().busy,false);assert.equal(writer.snapshot().uncertain,true);
  assert.equal((await writer.write(body)).status,'ignored');
  await writer.retry();
  assert.equal(requests[0],requests[1]);assert.equal(ids,1);assert.equal(confirmed,1);assert.equal(writer.snapshot().uncertain,false);
});

test('lost confirmation followed by rate limiting retains the original ID and respects Retry-After',async()=>{
  let now=10000,attempt=0,ids=0;
  const requests=[];
  const writer=createCommunityWriter({now:()=>now,makeId:()=>`fixture-${++ids}`,fetcher:async(_url,options)=>{
    requests.push(options.body);attempt++;
    if(attempt===1)throw Error('Response lost');
    if(attempt===2)return Response.json({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'30'}});
    return ok();
  }});
  await writer.write(body);await writer.retry();
  assert.equal(writer.snapshot().retryAt,40000);assert.equal(writer.snapshot().uncertain,true);
  assert.equal((await writer.retry()).status,'ignored');
  assert.equal((await writer.write({...body,body:'Second message'})).status,'ignored');
  assert.equal(attempt,2);
  now=40000;await writer.retry();
  assert.equal(new Set(requests).size,1);assert.equal(ids,1);assert.equal(writer.snapshot().uncertain,false);
});

test('Retry-After supports dates and uses a bounded local wait when the header is missing',async()=>{
  const now=Date.UTC(2026,9,14,8,0,0);
  for(const value of [new Date(now+45000).toUTCString(),null]) {
    const result=await sendCommunityMutation(body,{now:()=>now,fetcher:async()=>Response.json({error:'RATE_LIMITED'},{status:429,headers:value?{'Retry-After':value}:{}})});
    assert.equal(result.retryAt,now+(value?45000:60000));
  }
});

test('a rejection after an unknown result cannot unlock a duplicate send',async()=>{
  let attempt=0;
  const requests=[];
  const writer=createCommunityWriter({fetcher:async(_url,options)=>{
    requests.push(options.body);
    if(++attempt===1)throw Error('Lost response');
    if(attempt===2)return Response.json({error:'LOGIN_REQUIRED'},{status:401});
    return ok();
  }});
  await writer.write(body);await writer.retry();
  assert.equal(writer.snapshot().uncertain,true);assert.equal(writer.snapshot().error,'LOGIN_REQUIRED');
  assert.equal((await writer.write(body)).status,'ignored');
  await writer.retry();assert.equal(new Set(requests).size,1);
});

test('an initial validation rejection permits correction; malformed success does not confirm',async()=>{
  let attempt=0,confirmed=0;
  const writer=createCommunityWriter({onConfirmed:()=>confirmed++,fetcher:async()=>{
    if(++attempt===1)return Response.json({error:'INVALID_COMMUNITY_INPUT'},{status:400});
    if(attempt===2)return Response.json({unexpected:true});
    return ok();
  }});
  await writer.write(body);assert.equal(writer.snapshot().uncertain,false);
  await writer.write({...body,body:'Corrected'});assert.equal(writer.snapshot().uncertain,true);assert.equal(confirmed,0);
  await writer.retry();assert.equal(confirmed,1);
});

test('a rendering callback failure cannot turn a confirmed operation into a retry',async()=>{
  const writer=createCommunityWriter({fetcher:async()=>ok()});
  await assert.rejects(writer.write(body,()=>{throw Error('Rendering fixture');}),/Rendering fixture/);
  assert.equal(writer.snapshot().busy,false);assert.equal(writer.snapshot().uncertain,false);
  assert.equal((await writer.retry()).status,'ignored');
});
