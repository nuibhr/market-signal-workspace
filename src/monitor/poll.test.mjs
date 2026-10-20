import test from 'node:test';
import assert from 'node:assert/strict';
import {pollAfterCompletion} from './poll.mjs';
test('a request that takes longer than the poll interval finishes before another is scheduled',async()=>{
 let finish,scheduled,started=0;
 const stop=pollAfterCompletion(()=>{started++;return new Promise(r=>{finish=r;});},{schedule:fn=>{scheduled=fn;return 1;},cancel:()=>{}});
 assert.equal(started,1);assert.equal(scheduled,undefined);
 finish();await Promise.resolve();await Promise.resolve();assert.equal(typeof scheduled,'function');
 scheduled();assert.equal(started,2);stop();scheduled=null;finish();await Promise.resolve();await Promise.resolve();assert.equal(scheduled,null);
});
