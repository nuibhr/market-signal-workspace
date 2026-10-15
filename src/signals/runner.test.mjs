import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'signal-runner-'));process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {storage}=await import('../storage/database.mjs');const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {createSignalRunner}=await import('./runner.mjs');const {createSignalCloud}=await import('./cloud.mjs');
const {signalUniverse}=await import('./data.mjs');
const now=Date.parse('2026-10-15T05:30:00Z');
const daily=Array.from({length:150},(_,i)=>({time:new Date(Date.UTC(2026,4,1+i)).toISOString().slice(0,10),open:98+i*.02,high:100+i*.02,low:97+i*.02,close:99+i*.02,volume:10000}));
const four=Array.from({length:100},(_,i)=>{const c=101+Math.sin(i)*0.2;return {time:now/1000-15300-(99-i)*14400,open:c-.1,high:c+.2,low:c-.2,close:c,volume:10000};});
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('bounded scans continue across the roster after restart; a data-source failure stays explicit',async()=>{
 const loaded=[];const load=async(asset,frame)=>{loaded.push(asset.symbol);return {source:'unit-fixture',bars:frame==='1d'?daily:four};};
 const run=createSignalRunner({load,clock:()=>now,allowed:()=>true});
 const first=await run('thai',{maxSymbols:2});assert.equal(first.scanned,2);
 const second=await createSignalRunner({load,clock:()=>now,allowed:()=>true})('thai',{maxSymbols:2});assert.equal(second.scanned,2);
 assert.equal(new Set((await storage.all('SELECT symbol FROM signal_desk_observations WHERE market=?','thai')).map(r=>r.symbol)).size,4);
 const bad=createSignalRunner({load:async()=>{throw Error('fixture-outage');},clock:()=>now,allowed:()=>true});
 const symbol=signalUniverse('dr')[0].symbol;assert.equal((await bad('dr',{symbols:[symbol]})).status,'partial');
 const row=await storage.first('SELECT payload_json FROM signal_desk_observations WHERE market=? AND symbol=?','dr',symbol);
 assert.equal(JSON.parse(row.payload_json).code,'SOURCE_UNAVAILABLE');
});
test('cloud scheduling coalesces outstanding symbols and acknowledges duplicate deliveries without rerunning a completed batch',async()=>{
 let calls=0;const cloud=createSignalCloud({readiness:()=>({markets:[{id:'thai',status:'active'}]}),allowed:()=>true,run:async(m,task)=>{calls++;return {status:'complete',scanned:task.symbols.length};}});
 const messages=[];const queue={sendBatch:async(items)=>messages.push(...items)};
 const first=await cloud.schedule(queue,now);assert.ok(first.dispatched>0);const count=messages.length;
 await cloud.schedule(queue,now+1000);assert.ok(messages.length>=count);
 const assigned=[];for(const message of messages){const row=await storage.first('SELECT payload_json FROM scanner_jobs WHERE id=?',message.body.id);assigned.push(...JSON.parse(row.payload_json).symbols);}
 assert.equal(new Set(assigned).size,assigned.length,'outstanding symbols must not be enqueued twice');
 assert.equal((await cloud.consume(messages[0].body.id,now+2000)).status,'done');
 assert.equal((await cloud.consume(messages[0].body.id,now+3000)).status,'ignored');assert.equal(calls,1);
});
