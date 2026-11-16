import test from 'node:test';import assert from 'node:assert/strict';
import {loadChartBackup} from './chart-backup.mjs';
import {sharedCached,scanAgeMinutes,canonicalSharedSeries} from './shared-policy.mjs';
import {readApiJson} from '../security/api-response.mjs';
test('daily shared reads never fall through to the upstream provider, including missing snapshots',async()=>{
 let calls=0;const env={NODE_ENV:'production',SHARED_MARKET_DATA_MODE:'daily',SETTRADE_DISPLAY_RIGHTS_CONFIRMED:'true',YAHOO_DISPLAY_RIGHTS_CONFIRMED:'true'};
 const options={env,snapshot:async()=>({bars:[{close:35}],receivedAt:'2026-10-24T00:00:00Z',freshness:'stale'}),yahoo:async()=>{calls++;throw Error('PROVIDER_MUST_NOT_RUN');}};
 const cached=await loadChartBackup({id:'thai',symbol:'PTT'},'1d',options);assert.equal(cached.dataMode,'daily-snapshot');assert.equal(cached.live,false);
 await assert.rejects(loadChartBackup({id:'thai',symbol:'PTT'},'1d',{...options,snapshot:async()=>null}),/SHARED_SNAPSHOT_PENDING/);
 assert.equal(calls,0);
});
test('public daily cache coalesces reads and never requires a member identity',async()=>{
 const old=process.env.SHARED_MARKET_DATA_MODE;process.env.SHARED_MARKET_DATA_MODE='daily';let calls=0;
 try{const load=async()=>{calls++;return {price:35};};const rows=await Promise.all(Array.from({length:10},()=>sharedCached('fixture-public-only',load)));assert.equal(calls,1);assert.equal(rows[0].price,35);assert.equal(scanAgeMinutes('thai'),2160);}
 finally{if(old===undefined)delete process.env.SHARED_MARKET_DATA_MODE;else process.env.SHARED_MARKET_DATA_MODE=old;}
});
test('HTML outages become a user message instead of a JSON parser exception',async()=>{
 await assert.rejects(readApiJson(new Response('<html>Cloudflare error</html>',{status:503})),e=>!e.message.includes('Unexpected token')&&e.message.includes('เซิร์ฟเวอร์'));
 assert.deepEqual(await readApiJson(Response.json({price:35})),{price:35});
});
test('shared publisher canonicalizes the exact native SET symbol but never substitutes another instrument',()=>{
 const asset={id:'thai',symbol:'PTT',instrumentId:'SET100:PTT'};
 assert.equal(canonicalSharedSeries({symbol:'PTT',instrumentId:'SET:PTT'},asset).instrumentId,'SET100:PTT');
 assert.equal(canonicalSharedSeries({symbol:'AOT',instrumentId:'SET:AOT'},asset),null);
 assert.equal(canonicalSharedSeries({symbol:'PTT',instrumentId:'US_STOCKS:PTT'},asset),null);
});
