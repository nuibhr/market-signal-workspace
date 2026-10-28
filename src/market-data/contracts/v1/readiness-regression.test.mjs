import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSource} from './native-source.mjs';
import {projectEnvelope} from './pipeline.mjs';
import {compatibility} from './adapters.mjs';
import {createChartHandler} from './chart-handlers.mjs';
import {loadChartCandles} from '../../chart-client.mjs';
import {apiError} from './http.mjs';
import {ALL_ASSETS} from '../../../markets/catalog.mjs';
import {loadChartBackup} from '../../chart-backup.mjs';
const now=Date.parse('2026-10-28T08:00:00Z');
const bars=[{time:'2026-10-27',open:10,high:12,low:9,close:11,volume:100}];
const asset=ALL_ASSETS.find(a=>a.id==='thai'&&a.symbol==='CPALL');
const series={symbol:asset.symbol,instrumentId:asset.instrumentId,source:'Yahoo Finance · Delayed snapshot',timeframe:'1d',receivedAt:'2026-10-28T07:00:00Z',fallback:true,bars};
const rights=(providers=['settrade'],market='thai')=>Object.fromEntries(providers.map(id=>[id,{status:'CONFIRMED',markets:[market],evidenceId:'FIXTURE_ONLY_NOT_A_LICENSE',verifiedAt:'2026-10-01T00:00:00Z',validUntil:'2026-11-01T00:00:00Z'}]));
test('shared reader works without web credentials and never invokes native factories',async()=>{
 for(const market of ['thai','dr','us','tfex']){
  const a=ALL_ASSETS.find(a=>a.id===market);let reads=0,calls=0;
  const native=()=>{calls++;return {configuration:{configured:false}};};
  const load=createNativeSource({assets:()=>[a],clock:()=>now,sharedMode:()=>true,readShared:async()=>{reads++;return {...series,symbol:a.symbol,instrumentId:a.instrumentId,source:market==='us'?'Financial Modeling Prep · EOD':'Settrade · Delayed snapshot'};},createSettrade:native,createTfex:native,getUsBars:native});
  const row=(await load(market))[0];assert.equal(row.available,true,market);assert.equal(reads,1);assert.equal(calls,0);
  assert.equal(row.dataMode,'EOD');assert.equal(row.observedAt,null);
  if(market==='tfex')assert.equal(row.dataKind,'CANDLE');
 }
});
test('shared Yahoo provenance cannot pass Settrade-only rights or lose fallback status',async()=>{
 const client={configuration:{configured:true},getDailyCandles:async()=>series};
 const load=createNativeSource({assets:()=>[asset],clock:()=>now,sharedMode:()=>true,readShared:async()=>series,createSettrade:()=>client});
 const input=(await load('thai'))[0];
 const blocked=projectEnvelope([input],{market:'thai',tier:'STARTER',now,evidence:rights()});
 assert.deepEqual(blocked.records[0].data,{});
 const permitted=projectEnvelope([input],{market:'thai',tier:'STARTER',now,evidence:rights(['yahoo'])});
 assert.equal(permitted.records[0].source.providerId,'yahoo');assert.equal(permitted.records[0].source.fallback,true);
 assert.equal(permitted.records[0].data.price,11);assert.equal(permitted.records[0].eligibility.signal,false);
});
test('native-only chart rights allow its source and pass only authorized providers to reader',async()=>{
 let calls=0;
 const get=createChartHandler({assets:[asset],scanAssets:()=>[asset],currentMember:async()=>({id:'fixture'}),membershipFor:()=>({tier:'subscriber',planId:'starter'}),clock:()=>now,evidence:rights,closedAt:()=>now-1000,market:'thai',read:async(_request,context)=>{calls++;assert.deepEqual(context.allowedProviders,['settrade']);return Response.json({...series,source:'Settrade',status:'available'});}});
 const response=await get(new Request('https://fixture.invalid/api/chart?symbol=CPALL'));assert.equal(response.status,200);assert.equal(calls,1);assert.equal((await response.json()).bars.length,1);
});
test('canonical chart denials retain reason and never dispatch a backup',async()=>{
 for(const code of ['MEMBERSHIP_REQUIRED','AUTHENTICATION_REQUIRED','FORBIDDEN','DISPLAY_RIGHTS_NOT_CONFIRMED']){
  let calls=0;await assert.rejects(loadChartCandles(asset,'1d',{fetcher:async()=>{calls++;return apiError(code);}}),{code});assert.equal(calls,1,code);
 }
});
test('full quote adapters retain instrument identity required by Workspace',()=>{
 for(const market of ['us','tfex']){
  const a=ALL_ASSETS.find(a=>a.id===market),providerId=market==='us'?'fmp':'settrade';
  const input={market,symbol:a.symbol,instrumentId:a.instrumentId,providerId,providerState:'READY',dataMode:'EOD',dataKind:market==='us'?'EQUITY_EOD':'FUTURES_QUOTE',dataAsOf:series.receivedAt,receivedAt:series.receivedAt,qualityVerified:false,closed:true,data:{price:11}};
  const envelope=projectEnvelope([input],{market,tier:'STARTER',now,evidence:rights([providerId],market)});
  const quote=market==='us'?compatibility(envelope,'single'):compatibility(envelope,'tfex').quotes[0];
  assert.equal(quote.status,'available');assert.equal(quote.instrumentId,a.instrumentId);
  const guest=projectEnvelope([input],{market,tier:'GUEST',now,evidence:rights([providerId],market)});
  assert.equal(compatibility(guest,'single').instrumentId,undefined);
 }
});
test('Thai compatibility preserves catalog section and source price date for entitled rows',()=>{
 const input={market:'thai',symbol:asset.symbol,instrumentId:asset.instrumentId,providerId:'settrade',providerState:'READY',dataMode:'EOD',dataKind:'DAILY_BAR',dataAsOf:'2026-10-27T10:00:00Z',receivedAt:series.receivedAt,closed:true,qualityVerified:false,data:{price:11}};
 const envelope=projectEnvelope([input],{market:'thai',tier:'STARTER',now,evidence:rights()});
 const row=compatibility(envelope,'thai').rows[0];assert.equal(row.section,'SET100');assert.equal(row.priceDay,'2026-10-27');
});
test('backup authorization checks actual cached provider and never invokes an unlicensed fallback',async()=>{
 let yahooCalls=0;
 const options={allowedProviders:['settrade'],env:{NODE_ENV:'production'},snapshot:async()=>({...series,freshness:'delayed'}),yahoo:async()=>{yahooCalls++;return series;}};
 await assert.rejects(loadChartBackup(asset,'1d',options),{code:'BACKUP_NOT_AVAILABLE'});assert.equal(yahooCalls,0);
 await assert.rejects(loadChartBackup(asset,'1d',{...options,env:{SHARED_MARKET_DATA_MODE:'daily'}}),{code:'DISPLAY_RIGHTS_NOT_CONFIRMED'});assert.equal(yahooCalls,0);
 const permitted=await loadChartBackup(asset,'1d',{...options,allowedProviders:['yahoo']});assert.equal(permitted.source,series.source);assert.equal(yahooCalls,0);
});
test('shared source mismatch and unknown provenance remain unavailable; expiry rechecks cached rows',async()=>{
 for(const patch of [{instrumentId:'OTHER'}, {source:'Unknown vendor'}]){
  const load=createNativeSource({assets:()=>[asset],clock:()=>now,sharedMode:()=>true,readShared:async()=>({...series,...patch})});
  assert.equal((await load('thai'))[0].available,false);
 }
 let reads=0;const load=createNativeSource({assets:()=>[asset],clock:()=>now,sharedMode:()=>true,readShared:async()=>{reads++;return series;}});
 const row=(await load('thai'))[0];await load('thai');assert.equal(reads,1);
 const expired=rights(['yahoo']);expired.yahoo.validUntil=new Date(now-1).toISOString();
 assert.deepEqual(projectEnvelope([row],{market:'thai',tier:'STARTER',now,evidence:expired}).records[0].data,{});
});
