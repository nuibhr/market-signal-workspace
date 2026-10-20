import test from 'node:test';
import assert from 'node:assert/strict';
import {generateStrategyFeed,loadScanSeries} from './strategy-feed.mjs';
import {requestStrategyFeed} from './strategy-client.mjs';
import {radarChartAsset} from './chart-target.mjs';
const now=Date.parse('2026-10-20T08:00:00Z');
const series=asset=>({symbol:asset.symbol,instrumentId:asset.instrumentId,timeframe:'1d',source:'fixture closed history',chartOnly:true,
  bars:Array.from({length:90},(_,i)=>({time:new Date(now-(100-i)*86400000).toISOString().slice(0,10),open:20+i/10,high:21+i/10,low:19+i/10,close:20.5+i/10,volume:1000}))});
test('a failed provider is unavailable, never a synthetic price, pick or closed trade',async()=>{
 const data=await generateStrategyFeed({now,quotes:async()=>{throw Error();},loadSeries:async()=>{throw Error();}});
 assert.equal(data.status,'unavailable');assert.deepEqual(data.scoredDRs,[]);assert.deepEqual(data.scoredThaiStocks,[]);
 assert.equal(data.liveUsdThb,null);assert.deepEqual(data.autoTrackedPicks,[]);assert.equal(data.drKpis.winRate,'—');assert.equal(data.unavailable.length,14);
});
test('partial scans retain valid closed series and exclude mismatched symbols and current-day bars',async()=>{
 const data=await generateStrategyFeed({now,quotes:async()=>[],loadSeries:async asset=>{
  if(asset.symbol==='AAPL80')return {...series(asset),symbol:'WRONG'};
  const s=series(asset);s.bars.push({time:'2026-10-20',open:900,high:901,low:899,close:900,volume:1000});return s;
 }});
 assert.equal(data.status,'partial');assert.equal(data.coverage.dr.available,5);assert.equal(data.coverage.thai.available,8);
 assert.equal(data.scoredThaiStocks[0].barCount,90);assert.equal(data.scoredThaiStocks[0].currentPrice,29.4);
 assert.equal(data.scoredDRs.some(r=>r.symbol==='AAPL80'),false);assert.equal(data.scoredDRs[0].bridge,null);
 assert.equal(data.isLiveFeed,false);assert.equal(data.thaiKpis.winRate,'—');assert.deepEqual(data.autoTrackedPicks,[]);
});
test('scanner prefers configured native candles and falls back on provider failure',async()=>{
 const asset=radarChartAsset({symbol:'PTT',market:'SET'});let calls=0;
 const backup=async()=>{calls++;return series(asset);};
 assert.equal((await loadScanSeries(asset,{env:{},client:{configuration:{configured:true},getCandles:async()=>({...series(asset),instrumentId:`SET:${asset.symbol}`})},backup})).symbol,'PTT');
 assert.equal(calls,0);
 await loadScanSeries(asset,{env:{},client:{configuration:{configured:true},getCandles:async()=>{throw Error();}},backup});assert.equal(calls,1);
});
test('failed scan HTTP responses cannot be reported as success; partial results remain usable',async()=>{
 await assert.rejects(requestStrategyFeed({refresh:true,fetcher:async()=>Response.json({status:'unavailable'},{status:503})}));
 const data=await requestStrategyFeed({refresh:true,fetcher:async(_url,options)=>{
  assert.equal(options.method,'POST');return Response.json({status:'partial',scoredDRs:[],scoredThaiStocks:[]});}});assert.equal(data.status,'partial');
});
test('chart selection resolves the full existing market asset, including its feed and instrument identity',()=>{
 for(const [symbol,market,id] of [['PTT','SET','thai'],['NVDA80','DR80','dr']]){
  const asset=radarChartAsset({symbol,market});assert.equal(asset.id,id);assert.equal(asset.feed,'settrade-daily');assert.ok(asset.instrumentId);
 }
 assert.equal(radarChartAsset({symbol:'PTT',market:'DR80'}),null);assert.equal(radarChartAsset({symbol:'MISSING',market:'SET'}),null);
});
