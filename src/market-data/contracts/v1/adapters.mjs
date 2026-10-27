import {buildDecisionBrief} from '../../../signals/decision-brief.mjs';
import {summarizeSignals} from '../../../signals/model.mjs';
import {timestamp} from './pipeline.mjs';
// Names below are adapter identifiers, not a claim that a license is present.
export function providerFor(source){
 if(typeof source!=='string')return 'unknown';
 if(/Yahoo/i.test(source))return 'yahoo';
 if(/Financial Modeling Prep|FMP/i.test(source))return 'fmp';
 if(/Settrade|TFEX Open API/i.test(source))return 'settrade';
 return 'unknown';
}
export function legacyInput(row,market,{closeAt=()=>null}={}) {
 const day=row.dataAsOf??row.priceDay??row.latestDay??row.observedAt;
 const asOf=timestamp(day)??(/^\d{4}-\d\d-\d\d$/.test(day??'')?closeAt(market,day):null);
 const source=providerFor(row.source),scored=row.scored??row.plan??{};
 return {market,symbol:row.symbol,instrumentId:row.instrumentId??`${market.toUpperCase()}:${row.symbol}`,
  assetType:market==='us'&&row.kind==='etf'?'ETF':undefined,providerId:source,
  providerState:row.status==='unavailable'?'UNAVAILABLE':source==='unknown'?'UNKNOWN':'READY',
  dataMode:market==='tfex'&&source==='yahoo'?'REFERENCE':'EOD',
  dataKind:{thai:'SCANNER_CANDIDATE',dr:'DR_BRIDGE',us:row.kind==='etf'?'ETF_EOD':'EQUITY_EOD',tfex:'FUTURES_CANDIDATE',forex:'SCAN_CANDIDATE'}[market],
  dataAsOf:asOf,observedAt:timestamp(row.observedAt),receivedAt:timestamp(row.receivedAt),closed:Boolean(asOf),
  // Legacy calculations do not retain full quality/session evidence. Never turn
  // their score, HTTP status or cache check timestamp into signal eligibility.
  qualityVerified:false,fallback:row.chartOnly===true||row.fallback===true,
  available:row.status!=='unavailable'&&Number.isFinite(row.price??row.currentDrPrice),
  data:{price:row.price??row.currentDrPrice,changePct:row.changePct??row.changePercent,
   openInterest:row.openInterest,score:row.score??scored.totalScore,entry:row.entry??scored.entry,
   stopLoss:row.stopLoss??scored.sl,tp1:row.tp1??scored.tp1,tp2:row.tp2??scored.tp2}};
}
const legacyRow=r=>({symbol:r.instrument.symbol,status:r.status.availability.toLowerCase(),code:r.statusCodes.find(c=>!['AVAILABLE','UNAVAILABLE'].includes(c)),
 source:r.source.providerId,observedAt:r.timestamps.observedAt,dataAsOf:r.timestamps.dataAsOf,receivedAt:r.timestamps.receivedAt,
 freshness:r.status.freshness.toLowerCase(),signalEligible:r.eligibility.signal,chartOnly:r.status.usability==='CHART_ONLY',isLiveFeed:false,
 ...(r.projection==='FULL'?{...r.data,changePercent:r.data.changePct}:{} )});
export function compatibility(envelope,view='rows',options={}) {
 // Rebuild every aggregate from the projected rows, never spread the legacy feed.
 const full=envelope.records.filter(r=>r.projection==='FULL'),rows=full.map(legacyRow);
 const sample=envelope.records.find(r=>r.projection==='REDACTED');
 const base={status:envelope.status.availability.toLowerCase(),isLiveFeed:false,
  generatedAt:envelope.timestamps.generatedAt,market:envelope.market,
  redactedSample:sample?{symbol:sample.instrument.symbol,market:envelope.market,...sample.data,dataAsOf:sample.timestamps.dataAsOf}:null};
 if(view==='swing'){
  // Legacy observations do not retain the evidence needed for a Swing plan.
  const candidates=rows.map(r=>({...r,market:envelope.market,name:r.symbol,state:'UNAVAILABLE',mode:options.mode==='pullback'?'pullback':'breakout',plan:null,reasons:[r.code??'QUALITY_REJECTED']}));
  return {...base,notificationScope:`swing:${options.memberId??'guest'}:${envelope.market}`,rows:candidates,totalRows:candidates.length,page:1,pageSize:Math.max(1,envelope.entitlement.maxFullCards),
   dataMode:'daily-snapshot',scannedAt:envelope.timestamps.dataAsOf,decisionBrief:buildDecisionBrief(candidates),
   coverage:{expected:rows.length,observed:envelope.coverage.computedTotal,available:0,unavailable:rows.length,neverChecked:rows.length-envelope.coverage.computedTotal,lastCheckedAt:null},
   signals:[],history:[],events:[],record:null,recordEvents:[],recordStatistics:null,nextCursor:0,overview:null,worker:null,
   statistics:summarizeSignals([]),statisticsByMode:{breakout:summarizeSignals([]),pullback:summarizeSignals([])},usCosts:null,costs:null};
 }
 if(view==='daytrade'){
  const universe=rows.map(r=>({...r,name:r.symbol,status:'UNAVAILABLE',code:r.code??'QUALITY_REJECTED',side:null,monitorPlan:null,ranking:null,quote:null,latestBar:null,stale:true}));
  // The generic EOD/quote feed cannot impersonate a verified 15m strategy feed.
  return {...base,notificationScope:`daytrade:${options.memberId??'guest'}:canonical:${envelope.market}`,universe,coverage:{total:universe.length,ready:0,warmup:0,queued:0,unavailable:universe.length,fresh:0},
   connection:'unavailable',signalAccess:false,selected:null,monitorEvents:[],record:null,activeForward:[],forward:[],summary:null,
   mappingPending:0,volumeStatus:'UNKNOWN',policy:{allowNewSignals:false},source:envelope.providers.map(p=>p.id).join(' / ')};
 }
 if(view==='auto-pick')return {...base,status:'unavailable',readiness:{enabled:false,markets:[{id:envelope.market,status:'unavailable',universeCount:rows.length}]},
  workers:{},worker:null,workerProcess:null,coverage:{},signals:[],events:[],runs:[],outcomes:{},marketOutcomes:{},notificationScope:null};
 if(view==='radar'){
  const items=rows.filter(r=>r.signalEligible&&Number.isFinite(r.price)&&['entry','tp1','tp2','stopLoss','score'].every(k=>Number.isFinite(r[k]))).map(r=>({...r,currentDrPrice:r.price??null,currentPrice:r.price??null,
   scored:{totalScore:null,entry:null,tp1:null,tp2:null,sl:null,riskReward:null},bridge:null}));
  const stats={active:0,hitTp:'—',hitSl:'—',nearTp:0,winRate:'—',avgReturn:'—'};
  return {...base,timeframe:'1d',updatedAt:base.generatedAt,feedSource:envelope.providers.map(p=>p.id).join(' / '),
   scoredThaiStocks:envelope.market==='thai'?items:[],scoredDRs:envelope.market==='dr'?items:[],
   unavailable:rows.filter(r=>!r.signalEligible).map(r=>({symbol:r.symbol,market:envelope.market,code:r.code})),
   coverage:{thai:{total:envelope.market==='thai'?rows.length:0,available:envelope.market==='thai'?envelope.coverage.availableTotal:0},dr:{total:envelope.market==='dr'?rows.length:0,available:envelope.market==='dr'?envelope.coverage.availableTotal:0}},
   thaiKpis:{...stats},drKpis:{...stats},thaiSampleText:'',drSampleText:'',topMorningThai:[],topMorningDr:[],allMorningSignals:[],autoTrackedPicks:[],
   liveUsdThb:null,liveHkdThb:null,liveDividendStocks:[],dividendModel:[],avgDivYield:'—',dividendStatus:'unavailable'};
 }
 if(view==='thai')return {...base,rows:rows.map(r=>({name:r.symbol,price:null,changePercent:null,score:null,stage:null,criteria:[],templatePass:false,plan:null,rs:null,rsi:null,macdHistogram:null,rvol:null,pe:null,dividendPercent:null,...r})),assessmentOnly:true,stats:{expected:rows.length,observed:envelope.coverage.availableTotal,stage2:0,surge:0,rsLeaders:[],advance:rows.filter(r=>r.changePercent>0).length,decline:rows.filter(r=>r.changePercent<0).length,flat:rows.filter(r=>r.changePercent===0).length,index:null}};
 if(view==='single')return rows[0]??{...base,status:'unavailable'};
 if(view==='results')return {...base,results:rows,tier:envelope.entitlement.tier,timeframe:'1d',scannedAt:base.generatedAt};
 if(view==='plan'){const r=full.find(r=>r.eligibility.signal);return {status:r?'available':'unavailable',instrumentId:r?.instrument.instrumentId??full[0]?.instrument.instrumentId??null,plan:r?{tradeAllowed:false,entry:r.data.entry??null,stopLoss:r.data.stopLoss??null,tp1:r.data.tp1??null,tp2:r.data.tp2??null}:null};}
 if(view==='quotes'||view==='tfex')return {...base,quotes:rows,underlying:null,sourceTimeKnown:full.every(r=>r.source.sourceTimestampKnown)};
 return {...base,rows,signalAccess:full.some(r=>r.eligibility.signal),page:1,pages:1,total:rows.length,universe:rows.length};
}
