import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrategyFeedCache} from './strategy-feed-cache.mjs';
test('concurrent viewers and repeated refreshes share one ten-minute provider generation',async()=>{
 let now=1000000,calls=0,finish;
 const read=createStrategyFeedCache({clock:()=>now,load:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
 const first=Array.from({length:20},()=>read());await Promise.resolve();assert.equal(calls,1);
 finish({status:'available',updatedAt:'fixture'});const results=await Promise.all(first);
 assert.ok(results.every(r=>r.nextRefreshAt===new Date(now+600000).toISOString()));
 now+=599999;await read();assert.equal(calls,1);
 now++;const next=read();await Promise.resolve();assert.equal(calls,2);finish({status:'available',updatedAt:'next'});assert.equal((await next).updatedAt,'next');
});
test('a provider outage backs off for one minute and never relabels stale data as newly scanned',async()=>{
 let now=1000000,calls=0;
 const read=createStrategyFeedCache({clock:()=>now,load:async()=>{calls++;throw Error('provider-down');}});
 await assert.rejects(read());for(let i=0;i<10;i++)await assert.rejects(read());assert.equal(calls,1);
 now+=59999;await assert.rejects(read());assert.equal(calls,1);
 now++;await assert.rejects(read());assert.equal(calls,2);
});
