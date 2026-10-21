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
test('hidden tabs stop polling, resume once on visibility and never overlap an in-flight request',async()=>{
 let listener,timer,finish,starts=0,delay,cancelled=0;
 const visibility={visibilityState:'hidden',addEventListener:(_name,fn)=>{listener=fn;},removeEventListener:()=>{listener=null;}};
 const stop=pollAfterCompletion(()=>{starts++;return new Promise(r=>{finish=r;});},{visibility,intervalMs:600000,schedule:(fn,ms)=>{timer=fn;delay=ms;return 1;},cancel:()=>{cancelled++;timer=null;}});
 assert.equal(starts,0);
 visibility.visibilityState='visible';listener();listener();assert.equal(starts,1);
 visibility.visibilityState='hidden';listener();finish();await Promise.resolve();await Promise.resolve();assert.equal(timer,null);
 visibility.visibilityState='visible';listener();assert.equal(starts,2);finish();await Promise.resolve();await Promise.resolve();assert.equal(delay,600000);
 assert.equal(typeof timer,'function');stop();assert.equal(listener,null);assert.equal(timer,null);assert.ok(cancelled>0);
});
