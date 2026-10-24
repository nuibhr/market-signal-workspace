import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'thai-desk-test-'));process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {storage}=await import('../storage/database.mjs');const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {createThaiDeskRefresh}=await import('./thai-desk-refresh.mjs');const {thaiScreenerFeed}=await import('./thai-screener.mjs');
const now=Date.parse('2026-10-21T12:00:00Z');let calls=0;
const bars=Array.from({length:270},(_,i)=>{const close=20+i/20;return {time:new Date(Date.parse('2026-01-23T00:00:00Z')+i*86400000).toISOString().slice(0,10),open:close-.1,high:close+.2,low:close-.2,close,volume:100000+i*100};});
const refresh=createThaiDeskRefresh({clock:()=>now,benchmark:async()=>({bars:[]}),profile:async()=>null,load:async asset=>{calls++;if(asset.symbol==='AOT')throw Object.assign(Error(),{code:'SOURCE_UNAVAILABLE'});return {symbol:asset.symbol,instrumentId:asset.instrumentId,timeframe:'1d',source:'explicit test fixture',bars};}});
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('cold desk loads actual input bars without worker observations or trade publication, caches and preserves missing data',async()=>{
 const before=await storage.all('SELECT * FROM signal_desk_signals');
 const result=await refresh(['PTT','AOT']);assert.equal(result.loaded,1);
 const feed=await thaiScreenerFeed(now),ptt=feed.rows.find(r=>r.symbol==='PTT'),aot=feed.rows.find(r=>r.symbol==='AOT');
 assert.equal(ptt.price,bars.at(-1).close);assert.equal(ptt.source,'explicit test fixture');assert.equal(ptt.priceDay,bars.at(-1).time);assert.equal(ptt.rs.status,'unavailable');assert.equal(ptt.pe,null);
 assert.equal(aot.price,null);assert.equal(aot.source,null);assert.equal(feed.stats.observed,1);
 assert.deepEqual(await storage.all('SELECT * FROM signal_desk_signals'),before);assert.equal((await storage.all('SELECT * FROM signal_desk_observations')).length,0);
 const again=await refresh(['PTT','AOT']);assert.equal(again.cached,2);assert.equal(calls,2);
 const expired=await thaiScreenerFeed(now+21*60000);assert.equal(expired.rows.find(r=>r.symbol==='PTT').price,null);
});
test('desk accepts only bounded known Thai symbols',async()=>{await assert.rejects(refresh(['NVDA']),{code:'INVALID_SYMBOLS'});await assert.rejects(refresh(Array(9).fill('PTT')),{code:'INVALID_SYMBOLS'});});
test('mismatched provider instrument cannot appear as the requested stock',async()=>{
 const wrong=createThaiDeskRefresh({clock:()=>now,benchmark:async()=>({bars:[]}),profile:async()=>null,load:async()=>({symbol:'PTT',instrumentId:'SET:PTT',timeframe:'1d',source:'fixture',bars})});
 await wrong(['ADVANC']);const feed=await thaiScreenerFeed(now),row=feed.rows.find(r=>r.symbol==='ADVANC');assert.equal(row.price,null);assert.equal(row.code,'INSTRUMENT_MISMATCH');
});

test('a price-only refresh cannot displace a fresh worker assessment and its original 4H snapshot',async()=>{
 const original={market:'thai',symbol:'PTT',status:'UNAVAILABLE',checkedAt:new Date(now-1000).toISOString(),stage2:{price:123,priceDay:'2026-10-20',status:'available',criteria:[],score:5,stage:1}};
 await storage.run('INSERT INTO signal_desk_observations VALUES(?,?,?,?,?)','thai','PTT',JSON.stringify(original),now-1000,now+600000);
 const row=(await thaiScreenerFeed(now)).rows.find(r=>r.symbol==='PTT');assert.equal(row.price,123);assert.equal(row.score,5);
});
