import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
const dir=mkdtempSync(join(tmpdir(),'thai-stage2-'));process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
const {storage}=await import('../storage/database.mjs'),{sharedDatabase}=await import('../storage/sqlite.mjs');
const {thaiScreenerFeed}=await import('./thai-screener.mjs');
const now=Date.parse('2026-10-21T12:00:00Z');
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('dashboard joins public screening observations and fresh profiles, retains unknown symbols, and never writes trades',async()=>{
 const snapshot={symbol:'PTT',market:'thai',status:'UNAVAILABLE',checkedAt:new Date(now).toISOString(),stage2:{status:'available',price:35,priceDay:'2026-10-20',changePercent:1,stage:2,score:8,templatePass:true,criteria:[],rvol:2,rs:{status:'available',outperforming:true,excessReturnPercent:8},technical:{rsi:60,macdHistogram:.1}}};
 await storage.run('INSERT INTO signal_desk_observations VALUES(?,?,?,?,?)','thai','PTT',JSON.stringify(snapshot),now,now+600000);
 await storage.run('INSERT INTO provider_cache VALUES(?,?,?)','thai-stage2-profile:PTT',JSON.stringify({symbol:'PTT',name:'PTT fixture',pe:9,dividendPercent:6,sectorCode:'ENERG'}),now+86400000);
 const before=await storage.all('SELECT * FROM signal_desk_signals');
 const feed=await thaiScreenerFeed(now);assert.equal(feed.rows.length,150);assert.equal(feed.stats.observed,1);assert.equal(feed.stats.stage2,1);assert.equal(feed.stats.surge,1);assert.equal(feed.stats.advance,1);
 const ptt=feed.rows.find(r=>r.symbol==='PTT');assert.equal(ptt.pe,9);assert.equal(ptt.sector,'ENERG');assert.equal(feed.rows.find(r=>r.symbol!=='PTT').score,null);
 assert.deepEqual(await storage.all('SELECT * FROM signal_desk_signals'),before);
 const stale=await thaiScreenerFeed(now+21*60000);assert.equal(stale.stats.stage2,0);assert.equal(stale.rows.find(r=>r.symbol==='PTT').price,null);
 const expired=await thaiScreenerFeed(now+2*86400000);assert.equal(expired.rows.find(r=>r.symbol==='PTT').pe,null);
 const oldMode=process.env.NODE_ENV,oldRights=process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED;
 try{process.env.NODE_ENV='production';delete process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED;
  assert.equal((await thaiScreenerFeed(now)).rows.find(r=>r.symbol==='PTT').pe,null,'cached Yahoo metadata still requires display rights in production');
 }finally{if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;if(oldRights===undefined)delete process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED;else process.env.YAHOO_DISPLAY_RIGHTS_CONFIRMED=oldRights;}
});
