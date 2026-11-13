import {randomUUID} from 'node:crypto';
import {ENTITLEMENT_CAPS,MARKET_IDS,RIGHTS_STATES} from './status-codes.mjs';
import {validateEnvelopeInvariants} from './validate-envelope.mjs';
const none=()=>({chart:false,signal:false,performance:false,execution:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const timestamp=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?x:null;
const sessionUnknown=()=>({state:'UNKNOWN',closed:null,timezone:null,calendarId:null});
const uniq=xs=>[...new Set(xs)];
export function canonicalTier(rights) {
 if(rights?.tier==='trial')return 'TRIAL';
 if(rights?.tier==='subscriber') {
  const tier=rights.planId?.toUpperCase();
  if(['STARTER','PRO','ULTIMATE'].includes(tier))return tier;
  // Existing admin-issued membership has the established eight-card allowance.
  if(!rights.planId&&rights.limits?.dailyScanSymbols===8)return 'ULTIMATE';
 }
 return 'GUEST';
}
export function displayRights(evidence,market,providerId,now) {
 const row=evidence?.[providerId];
 if(!row||!Array.isArray(row.markets)||!row.markets.includes(market))return 'UNCONFIRMED';
 if(['DENIED','EXPIRED'].includes(row.status))return row.status;
 if(row.status!=='CONFIRMED'||!row.evidenceId||!timestamp(row.verifiedAt)||Date.parse(row.verifiedAt)>now)return 'UNCONFIRMED';
 if(!timestamp(row.validUntil))return 'UNCONFIRMED';
 return Date.parse(row.validUntil)<=now?'EXPIRED':'CONFIRMED';
}
const kinds={thai:['DAILY_BAR','QUOTE','SCANNER_CANDIDATE'],dr:['DR_DAILY_BAR','UNDERLYING_REFERENCE','FX_REFERENCE','DR_BRIDGE'],us:['EQUITY_EOD','ETF_EOD','QUOTE','CHART'],tfex:['FUTURES_CANDIDATE','FUTURES_QUOTE','CANDLE','OPTIONS_CHAIN'],forex:['FX_QUOTE','CANDLE','SCAN_CANDIDATE']};
const fields=['price','open','high','low','close','volume','changePct','bid','ask','openInterest','score','entry','tp1','tp2','stopLoss'];
function values(input,market) {
 const data={};
 for(const key of fields)if(finite(input?.[key]))data[key]=input[key];
 if(market==='tfex')data.openInterest=finite(input?.openInterest)?input.openInterest:null;
 if(Array.isArray(input?.bars))data.bars=input.bars.slice(-1000).map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,...(finite(b.volume)?{volume:b.volume}:{})}));
 if(typeof input?.timeframe==='string'&&['15m','1h','4h','1d'].includes(input.timeframe))data.timeframe=input.timeframe;
 return data;
}
export function normalizeRecord(input,{market,now,evidence={},calendar=()=>null,policy=null}) {
 const codes=[];
 const providerId=['settrade','fmp','yahoo','owner-ingest','unknown'].includes(input.providerId)?input.providerId:'unknown';
 const rights=displayRights(evidence,market,providerId,now);
 const mode=['EOD','DELAYED','HISTORICAL','REFERENCE'].includes(input.dataMode)?input.dataMode:'UNKNOWN';
 const timestamps={dataAsOf:timestamp(input.dataAsOf),observedAt:timestamp(input.observedAt),receivedAt:timestamp(input.receivedAt),generatedAt:new Date(now).toISOString()};
 for(const key of ['dataAsOf','observedAt','receivedAt'])if(input[key]!=null&&!timestamps[key])codes.push('INVALID_TIMESTAMP');
 const basis=timestamps.dataAsOf?'DATA_AS_OF':timestamps.observedAt?'OBSERVED_AT':'UNKNOWN';
 const sourceTime=timestamps.dataAsOf??timestamps.observedAt;
 let state='UNKNOWN',ageSeconds=null;
 if(!sourceTime)codes.push('MISSING_SOURCE_TIMESTAMP','UNKNOWN_FRESHNESS');
 else if([timestamps.dataAsOf,timestamps.observedAt].some(t=>t&&Date.parse(t)>now))codes.push('FUTURE_TIMESTAMP','UNKNOWN_FRESHNESS');
 else {
  ageSeconds=Math.floor((now-Date.parse(sourceTime))/1000);
  if(policy?.id&&Number.isInteger(policy.maxAgeSeconds)&&policy.maxAgeSeconds>=0){state=ageSeconds<=policy.maxAgeSeconds?'FRESH':'STALE';}
  if(mode==='EOD') {
   const expected=calendar(market,now);
   if(!expected?.verified||!timestamp(expected.closeAt)){state='UNKNOWN';codes.push('UNKNOWN_FRESHNESS');}
   else if(sourceTime!==expected.closeAt&&Date.parse(sourceTime)!==Date.parse(expected.closeAt)) {state='STALE';codes.push('WRONG_SESSION');}
   else state='FRESH';
  }
 }
 if(state==='STALE')codes.push('STALE',mode==='EOD'?'STALE_BAR':'STALE_QUOTE');
 if(state==='UNKNOWN')codes.push('UNKNOWN_FRESHNESS');
 const bars=input.data?.bars;
 if(['open','high','low','close'].some(k=>input.data?.[k]!==undefined)){
  const b=input.data;
  if(![b.open,b.high,b.low,b.close].every(x=>finite(x)&&x>0)||b.high<Math.max(b.open,b.low,b.close)||b.low>Math.min(b.open,b.close))codes.push('INVALID_OHLC');
 }
 const prices=['price','bid','ask','entry','tp1','tp2','stopLoss'].filter(k=>input.data?.[k]!=null);
 if(prices.some(k=>!finite(input.data[k])||input.data[k]<=0)||['volume','openInterest'].some(k=>input.data?.[k]!=null&&(!finite(input.data[k])||input.data[k]<0))||
  (finite(input.data?.bid)&&finite(input.data?.ask)&&input.data.ask<input.data.bid))codes.push('QUALITY_REJECTED');
 if(!finite(input.data?.price)&&!(Array.isArray(bars)&&bars.length))codes.push('QUALITY_REJECTED');
 let invalid=codes.includes('INVALID_OHLC')||codes.includes('QUALITY_REJECTED');
 if(bars!==undefined){
  if(!Array.isArray(bars)||bars.length>1000){codes.push('QUALITY_REJECTED');invalid=true;}
  else {
   const times=new Set();let previous=-Infinity;
   for(const b of bars){
    const time=typeof b.time==='number'?b.time*1000:Date.parse(b.time);
    if(!Number.isFinite(time)){codes.push('INVALID_TIMESTAMP');invalid=true;}
    if(times.has(time)){codes.push('DUPLICATE_DATA');invalid=true;}times.add(time);
    if(time<previous){codes.push('QUALITY_REJECTED');invalid=true;}previous=time;
    if(![b.open,b.high,b.low,b.close].every(x=>finite(x)&&x>0)||b.high<Math.max(b.open,b.low,b.close)||b.low>Math.min(b.open,b.close)){codes.push('INVALID_OHLC');invalid=true;}
    const close=typeof b.time==='number'?time+({ '15m':900,'1h':3600,'4h':14400,'1d':86400 }[input.data.timeframe]??86400)*1000:timestamp(b.closedAt)?Date.parse(b.closedAt):null;
    if(b.closed===false||close>now||time>now){codes.push('INCOMPLETE_BAR');invalid=true;}
   }
  }
 }
 if(!kinds[market]?.includes(input.dataKind)){codes.push('QUALITY_REJECTED');invalid=true;}
 if(input.qualityVerified!==true)codes.push('QUALITY_REJECTED');
 if(input.closed===false)codes.push('INCOMPLETE_BAR');
 if(input.minimumHistory&&(!Number.isInteger(input.historyCount)||input.historyCount<input.minimumHistory))codes.push('INSUFFICIENT_HISTORY');
 if(market==='dr'&&input.dataKind==='DR_BRIDGE'){
  const b=input.bridge;
  if(!b?.mappingVerified)codes.push('NOT_MAPPED');
  if(!b?.underlying||displayRights(evidence,'dr',b?.underlying?.providerId,now)!=='CONFIRMED')codes.push('MISSING_UNDERLYING');
  if(!b?.fx||displayRights(evidence,'dr',b?.fx?.providerId,now)!=='CONFIRMED')codes.push('MISSING_FX');
  if(!b?.currency||b.currency!==b?.underlying?.currency||b.currency!==b?.fx?.baseCurrency||b?.fx?.quoteCurrency!=='THB')codes.push('CURRENCY_MISMATCH');
  const times=[timestamps.dataAsOf,b?.underlying?.dataAsOf,b?.fx?.dataAsOf].map(t=>timestamp(t)?Date.parse(t):NaN);
  if(!times.every(Number.isFinite)||times.some(t=>t>now)||Math.max(...times)-Math.min(...times)>900000)codes.push('AS_OF_NOT_ALIGNED');
 }
 if(market==='forex'){
  if(input.ownerIngest!==true||providerId!=='owner-ingest'||input.connectionActive!==true)codes.push('SOURCE_UNAVAILABLE');
  const beat=timestamp(input.heartbeatAt);
  if(!beat||Date.parse(beat)>now||now-Date.parse(beat)>30000)codes.push('SOURCE_UNAVAILABLE');
  if(!Array.isArray(bars)||bars.length<60||input.data.timeframe!=='15m')codes.push('WARMUP_REQUIRED');
 }
 if(rights!=='CONFIRMED')codes.push(rights==='DENIED'?'DISPLAY_RIGHTS_DENIED':rights==='EXPIRED'?'DISPLAY_RIGHTS_EXPIRED':'DISPLAY_RIGHTS_NOT_CONFIRMED');
 const provider=['READY','DEGRADED','NOT_CONFIGURED','UNAVAILABLE'].includes(input.providerState)?input.providerState:'UNKNOWN';
 if(!['READY','DEGRADED'].includes(provider))codes.push(provider==='NOT_CONFIGURED'?'SOURCE_NOT_CONFIGURED':'SOURCE_UNAVAILABLE');
 const fallback=input.fallback===true;
 const reference=mode==='REFERENCE'||mode==='HISTORICAL';
 const blocked=rights!=='CONFIRMED'||invalid||input.available===false||codes.includes('SOURCE_UNAVAILABLE')||provider==='NOT_CONFIGURED';
 const signal=!blocked&&state==='FRESH'&&!fallback&&!reference&&mode!=='UNKNOWN'&&provider==='READY'&&input.qualityVerified===true&&input.closed===true&&!codes.some(c=>['INCOMPLETE_BAR','INSUFFICIENT_HISTORY','NOT_MAPPED','MISSING_UNDERLYING','MISSING_FX','CURRENCY_MISMATCH','AS_OF_NOT_ALIGNED','WARMUP_REQUIRED'].includes(c));
 const availability=blocked?'UNAVAILABLE':'AVAILABLE',usability=blocked?'BLOCKED':signal?'SIGNAL_ELIGIBLE':'CHART_ONLY';
 let data=blocked?{}:values(input.data,market);
 // Derived levels are unavailable whenever prerequisites fail, including DR bridges.
 if(!signal)for(const key of ['score','entry','tp1','tp2','stopLoss'])delete data[key];
 const statusCodes=uniq([availability,usability,...codes]);
 return {projection:'FULL',instrument:{instrumentId:input.instrumentId,symbol:input.symbol,market,assetType:input.assetType??({thai:'EQUITY',dr:'DR',us:'EQUITY',tfex:'FUTURE',forex:'FX_PAIR'}[market])},dataKind:input.dataKind,
  status:{availability,freshness:state,usability,provider,rights,codes:statusCodes},timestamps,
  freshness:{state,basis,ageSeconds,maxAgeSeconds:policy?.maxAgeSeconds??null,evaluatedAt:timestamps.generatedAt,policyId:policy?.id??null},
  session:{...sessionUnknown(),closed:input.closed===true?true:input.closed===false?false:null},
  source:{providerId,type:providerId==='owner-ingest'?'INTERNAL_INGEST':reference?'REFERENCE':'LICENSED_VENDOR',dataMode:mode,sourceTimestampKnown:Boolean(timestamps.observedAt),isLiveFeed:false,rightsStatus:rights,fallback},
  eligibility:{chart:!blocked,signal,performance:false,execution:false},statusCodes,data};
}
export function projectEnvelope(inputs,{market,tier='GUEST',now=Date.now(),evidence={},calendar,policy,requestId=randomUUID(),snapshotId=null,kind='MARKET_SCAN',query={}}) {
 if(!MARKET_IDS.includes(market)||!Object.hasOwn(ENTITLEMENT_CAPS,tier))throw Error('INVALID_REQUEST');
 const caps=ENTITLEMENT_CAPS[tier];
 // One stable selection BEFORE user filters, symbol lookup, page or diagnostics.
 // All representations of the scan share this selection and cannot page around it.
 const unique=new Map();
 for(const input of inputs){if(input.market===market&&typeof input.symbol==='string'&&!unique.has(input.symbol))unique.set(input.symbol,input);}
 const selected=[...unique.values()].slice(0,caps.maxFullCards||caps.redactedSampleLimit);
 let rows=selected.map(input=>normalizeRecord(input,{market,now,evidence,calendar,policy}));
 if(tier==='GUEST')rows=rows.map(row=>{
  const blocked=row.status.usability==='BLOCKED';
  return {projection:'REDACTED',instrument:{symbol:row.instrument.symbol,market},status:{...row.status,usability:blocked?'BLOCKED':'DISPLAY_ONLY',codes:uniq(row.status.codes.filter(c=>!['SIGNAL_ELIGIBLE','CHART_ONLY'].includes(c)).concat(blocked?'BLOCKED':'DISPLAY_ONLY'))},
   timestamps:row.timestamps,freshness:row.freshness,session:row.session,source:row.source,eligibility:none(),statusCodes:row.statusCodes.filter(c=>!['SIGNAL_ELIGIBLE','CHART_ONLY'].includes(c)),data:blocked?{}:{changePct:row.data.changePct??null}};
 });
 if(query.symbols)rows=rows.filter(r=>query.symbols.includes(r.instrument.symbol));
 if(query.symbol)rows=rows.filter(r=>r.instrument.symbol===query.symbol);
 if(query.q)rows=rows.filter(r=>r.instrument.symbol.includes(query.q));
 if(query.page&&Number(query.page)>1)rows=[];
 const available=rows.filter(r=>r.status.availability==='AVAILABLE').length;
 const availability=!available?'UNAVAILABLE':available<rows.length?'PARTIAL':'AVAILABLE';
 const freshness=rows.length&&rows.every(r=>r.status.freshness==='FRESH')?'FRESH':rows.some(r=>r.status.freshness==='STALE')?'STALE':'UNKNOWN';
 const usability=!available?'BLOCKED':rows.every(r=>r.eligibility.signal)?'SIGNAL_ELIGIBLE':tier==='GUEST'?'DISPLAY_ONLY':'CHART_ONLY';
 const rights=rows.length&&rows.every(r=>r.status.rights==='CONFIRMED')?'CONFIRMED':'UNCONFIRMED';
 const full=tier==='GUEST'?0:rows.length,redacted=tier==='GUEST'?rows.length:0;
 const consistent=key=>rows.length&&rows.every(r=>r.timestamps[key]===rows[0].timestamps[key])?rows[0].timestamps[key]:null;
 const generatedAt=new Date(now).toISOString();
 const status={availability,freshness,usability,provider:rows.length&&rows.every(r=>r.status.provider==='READY')?'READY':'UNKNOWN',rights,
  codes:uniq([availability,usability,...(freshness==='STALE'?['STALE']:[]),...rows.flatMap(r=>r.status.codes).filter(c=>!['AVAILABLE','UNAVAILABLE','PARTIAL','SIGNAL_ELIGIBLE','CHART_ONLY','DISPLAY_ONLY','BLOCKED'].includes(c))])};
 const envelope={schemaVersion:'nugaom.market-data.v1',requestId,snapshotId,market,selectedScope:{market,kind},status,
  timestamps:{dataAsOf:consistent('dataAsOf'),observedAt:consistent('observedAt'),receivedAt:consistent('receivedAt'),generatedAt},
  freshness:{state:freshness,basis:consistent('dataAsOf')?'DATA_AS_OF':'UNKNOWN',ageSeconds:null,maxAgeSeconds:policy?.maxAgeSeconds??null,evaluatedAt:generatedAt,policyId:policy?.id??null},session:sessionUnknown(),
  providers:[...new Map(rows.map(r=>[r.source.providerId,{id:r.source.providerId,type:r.source.type,status:r.status.provider,rightsStatus:r.source.rightsStatus,dataMode:r.source.dataMode}])).values()],
  coverage:{disclosureScope:'ENTITLED_PROJECTION',catalogTotal:null,computedTotal:rows.filter(r=>unique.get(r.instrument.symbol)?.attempted!==false).length,availableTotal:available,visibleTotal:rows.length,staleTotal:rows.filter(r=>r.status.freshness==='STALE').length,unavailableTotal:rows.length-available,chartOnlyTotal:rows.filter(r=>r.status.usability==='CHART_ONLY').length,visibleFullCards:full,visibleRedactedSamples:redacted},
  entitlement:{tier,selectedMarket:market,...caps,fullCardsReturned:full,redactedSamplesReturned:redacted,resolvedServerSide:true},records:rows};
 if(!validateEnvelopeInvariants(envelope).valid)throw Error('INVALID_CANONICAL_OUTPUT');
 return envelope;
}
