import {canonicalTier,displayRights,projectEnvelope} from './pipeline.mjs';
import {providerFor} from './adapters.mjs';
import {ENTITLEMENT_CAPS,MARKET_IDS} from './status-codes.mjs';
import {apiError,privateHeaders} from './http.mjs';
import {validateOutput} from './schema-validator.mjs';
// Legacy chart adapter owns only an authorized, single projected instrument.
export function createChartHandler({read,currentMember,membershipFor,assets,scanAssets,evidence,closedAt,market:fixedMarket,clock=Date.now}){
 return async request=>{
  try{
   const params=new URL(request.url).searchParams,symbol=params.get('symbol')?.trim().toUpperCase(),timeframe=params.get('timeframe')??'1d';
   let market=params.get('market')??fixedMarket;
   if(!market)market=assets.find(a=>a.symbol===symbol&&['thai','dr'].includes(a.id))?.id;
   if(!MARKET_IDS.includes(market)||(fixedMarket&&market!==fixedMarket))return apiError('INVALID_MARKET');
   if(!['15m','1h','4h','1d'].includes(timeframe))return apiError('INVALID_DATA_REQUEST');
   if(market==='us'&&timeframe!=='1d')return apiError('INVALID_DATA_REQUEST');
   const asset=assets.find(a=>a.id===market&&a.symbol===symbol);if(!asset)return apiError('INVALID_SYMBOL');
   const tier=canonicalTier(membershipFor(await currentMember(request))),cap=ENTITLEMENT_CAPS[tier].maxFullCards;
   if(!scanAssets(market,asset.sectionId==='US_ETFS'?'etf':'default').slice(0,cap).some(a=>a.symbol===symbol))return apiError('MEMBERSHIP_REQUIRED');
   const now=clock(),rights=evidence(),sources=market==='us'?['fmp','yahoo']:market==='forex'?['owner-ingest']:['settrade','yahoo'];
   if(!sources.every(id=>displayRights(rights,market,id,now)==='CONFIRMED'))return apiError('DISPLAY_RIGHTS_NOT_CONFIRMED');
   // Customer FX charts must originate from the owner ingest service, never the
   // old generic Yahoo/history path. That path cannot establish owner provenance.
   if(market==='forex')return apiError('SOURCE_NOT_CONFIGURED');
   const response=await read(request);if(!response.ok)return apiError(response.status===400?'INVALID_DATA_REQUEST':'PROVIDER_UNAVAILABLE');
   const data=await response.json();
   if(data.instrumentId!==asset.instrumentId||data.symbol!==symbol||data.timeframe!==timeframe)return apiError('PROVIDER_UNAVAILABLE');
   const bars=data.bars;
   if(!Array.isArray(bars)||!bars.length)return apiError('PROVIDER_UNAVAILABLE');
   const closed=closedAt(bars.at(-1),timeframe,market),dataAsOf=Number.isFinite(closed)?new Date(closed).toISOString():null;
   const envelope=projectEnvelope([{market,symbol,instrumentId:asset.instrumentId,assetType:asset.sectionId==='US_ETFS'?'ETF':undefined,
    providerId:providerFor(data.source),providerState:'READY',dataMode:timeframe==='1d'?'EOD':'DELAYED',
    dataKind:{thai:'DAILY_BAR',dr:'DR_DAILY_BAR',us:asset.sectionId==='US_ETFS'?'ETF_EOD':'EQUITY_EOD',tfex:'CANDLE'}[market],
    dataAsOf,observedAt:data.observedAt??null,receivedAt:data.receivedAt??null,qualityVerified:false,closed:closed<=now,
    fallback:data.fallback===true||data.chartOnly===true,data:{bars:bars.map(b=>({...b,closedAt:Number.isFinite(closedAt(b,timeframe,market))?new Date(closedAt(b,timeframe,market)).toISOString():null})),timeframe}}],{market,tier,now,evidence:rights,kind:'CHART'});
   if(!validateOutput(envelope).valid)return apiError('INTERNAL_ERROR');
   if(params.get('format')==='canonical')return Response.json(envelope,{headers:privateHeaders});
   const row=envelope.records[0];
   return Response.json({status:row.status.availability.toLowerCase(),instrumentId:asset.instrumentId,symbol,market,timeframe,
    source:row.source.providerId,receivedAt:row.timestamps.receivedAt,dataAsOf:row.timestamps.dataAsOf,observedAt:row.timestamps.observedAt,
    freshness:row.status.freshness.toLowerCase(),signalEligible:false,executionEligible:false,chartOnly:row.eligibility.chart,
    fallback:row.source.fallback,live:false,isLiveFeed:false,quote:null,bars:row.data.bars??[],availableBars:row.data.bars?.length??0}, {headers:privateHeaders});
  }catch{return apiError('INTERNAL_ERROR');}
 };
}
