import test from 'node:test';
import assert from 'node:assert/strict';
import {generateStrategyFeed,loadScanSeries} from './strategy-feed.mjs';
import {requestStrategyFeed} from './strategy-client.mjs';
import {radarChartAsset,radarRowsForMarket} from './chart-target.mjs';
const now=Date.parse('2026-10-20T08:00:00Z');
test('shared saved Radar plans and voice rows are scoped by market without deleting the other market or accepting unknown identities',()=>{
 const rows=[{symbol:'PTT',market:'SET'},{symbol:'AAPL80',market:'DR80'},{symbol:'KBANK',market:'thai'},{symbol:'MSFT80',market:'dr'},{symbol:'UNKNOWN',market:'other'}];
 const before=JSON.stringify(rows);
 assert.deepEqual(radarRowsForMarket(rows,'thai').map(r=>r.symbol),['PTT','KBANK']);
 assert.deepEqual(radarRowsForMarket(rows,'dr').map(r=>r.symbol),['AAPL80','MSFT80']);
 assert.deepEqual(radarRowsForMarket(rows,'unknown'),[]);assert.equal(JSON.stringify(rows),before);
});
const series=asset=>({symbol:asset.symbol,instrumentId:asset.instrumentId,timeframe:'1d',source:'fixture closed history',chartOnly:true,
  bars:Array.from({length:90},(_,i)=>({time:new Date(now-(90-i)*86400000).toISOString().slice(0,10),open:20+i/10,high:21+i/10,low:19+i/10,close:20.5+i/10,volume:1000}))});
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
 assert.equal((await loadScanSeries(asset,{now,env:{},client:{configuration:{configured:true},getCandles:async()=>({...series(asset),instrumentId:`SET:${asset.symbol}`})},backup})).symbol,'PTT');
 assert.equal(calls,0);
 await loadScanSeries(asset,{now,env:{},client:{configuration:{configured:true},getCandles:async()=>{throw Error();}},backup});assert.equal(calls,1);
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

test('old, malformed and stale-provider daily bars cannot become current Radar candidates',async()=>{
 for(const mutate of [s=>({...s,freshness:'stale'}),s=>({...s,bars:s.bars.map(b=>({...b,time:b.time.replace('2026','2020')}))}),s=>({...s,bars:[...s.bars,s.bars.at(-1)]}),s=>({...s,bars:s.bars.map(b=>({...b,low:b.high+1}))})]){
  const data=await generateStrategyFeed({now,quotes:async()=>[],loadSeries:async a=>mutate(series(a))});
  assert.equal(data.status,'unavailable');assert.deepEqual(data.allMorningSignals,[]);
 }
});
test('verified metadata and synchronized quotes determine fair price; mismatched times never do',async()=>{
 const {DR_SPECS,comparableBridge,expectedClosedDay}=await import('./strategy-feed.mjs');
 const spec=DR_SPECS.find(s=>s.symbol==='NVDA80'),stamp=new Date('2026-10-19T10:00:00Z');
 assert.equal(spec.ratio,200);assert.equal(DR_SPECS.find(s=>s.symbol==='MSFT80').ratio,2000);assert.equal(DR_SPECS.find(s=>s.symbol==='TSLA80').ratio,5000);
 assert.equal(DR_SPECS.find(s=>s.symbol==='BABA80').underlying,'9988.HK');
 const quote=n=>({regularMarketPrice:n,regularMarketTime:stamp});
 assert.equal(comparableBridge(spec,quote(200),quote(32),32,'2026-10-19',now).fairPriceThb,32);
 assert.equal(comparableBridge(spec,{...quote(200),regularMarketTime:new Date(now)},quote(32),32,'2026-10-19',now),null);
 assert.equal(expectedClosedDay(Date.parse('2026-10-19T08:00:00Z')),'2026-10-15');
 const data=await generateStrategyFeed({now,loadSeries:async a=>series(a),quotes:async()=>[{symbol:'TISCO.BK',regularMarketPrice:100,dividendRate:1}]});
 assert.deepEqual(data.liveDividendStocks,[]);assert.equal(data.dividendStatus,'unavailable');
});

test('native series with future placeholders and an old last closed bar fall back to labelled recent history',async()=>{
 const asset=radarChartAsset({symbol:'NVDA80',market:'dr'});let used=0;
 const native={...series(asset),instrumentId:`SET:${asset.symbol}`,bars:[{time:'2020-01-01'},{time:'2026-10-20'},{time:'2026-10-21'}]};
 const value=await loadScanSeries(asset,{now,env:{},client:{configuration:{configured:true},getCandles:async()=>native},backup:async()=>{used++;return {...series(asset),source:'labelled historical backup'};}});
 assert.equal(used,1);assert.equal(value.source,'labelled historical backup');
});

test('Thai Radar loads only Thai candles and makes no underlying/FX requests',async()=>{
 const loaded=[];const data=await generateStrategyFeed({now,markets:['thai'],quotes:async()=>{throw Error('Thai view must not request overseas quotes');},loadSeries:async asset=>{assert.equal(asset.id,'thai');loaded.push(asset.symbol);return series(asset);}});
 assert.equal(loaded.length,8);assert.equal(data.scoredThaiStocks.length,8);assert.deepEqual(data.scoredDRs,[]);assert.equal(data.liveUsdThb,null);
 await requestStrategyFeed({market:'thai',fetcher:async(url)=>{assert.equal(url,'/api/dr-strategy/feed?market=thai');return Response.json({status:'available',scoredDRs:[],scoredThaiStocks:[]});}});
});

// Isolated entitlement fixture; does not certify a real vendor license.
test('production DR does not fetch or expose Yahoo quotes without confirmed display rights',async()=>{
 let calls=0;const data=await generateStrategyFeed({now,markets:['dr'],env:{NODE_ENV:'production'},quotes:async()=>{calls++;return [{symbol:'USDTHB=X',regularMarketPrice:32}];},loadSeries:async a=>series(a)});
 assert.equal(calls,0);assert.equal(data.liveUsdThb,null);assert.equal(data.liveHkdThb,null);assert.equal(data.quoteStatus,'DISPLAY_RIGHTS_NOT_CONFIRMED');assert.ok(data.scoredDRs.every(r=>r.bridge===null));
});
