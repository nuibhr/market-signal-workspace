import {buildDecisionBrief} from '../../../signals/decision-brief.mjs';
import {summarizeSignals} from '../../../signals/model.mjs';
import {timestamp} from './pipeline.mjs';
import {ALL_ASSETS,US_ETFS,US_STOCKS} from '../../../markets/catalog.mjs';
import {evaluateMinerviniStage2} from '../../../analysis/minervini-stage2.mjs';
import {calcMacd,calcRsi,scoreDRCandidate,THAI_DIVIDEND_PORTFOLIO_MODEL} from '../../../dr/strategy-tracker.mjs';
import {DR_SPECS} from '../../../dr/strategy-feed.mjs';
import {buildUsEodPlan} from '../../../auto-pick/us-engine.mjs';
const catalogById=new Map(ALL_ASSETS.map(asset=>[asset.instrumentId,asset]));
const usInfoBySymbol=new Map([...US_STOCKS,...US_ETFS].map(asset=>[asset.symbol,asset]));
const drSpecBySymbol=new Map(DR_SPECS.map(spec=>[spec.symbol,spec]));
function enrichThaiRow(r){
 const asset=catalogById.get(r.instrumentId);
 const baseRow={name:asset?.name??r.symbol,sector:asset?.sector??null,section:asset?.sectionId??null,priceDay:r.dataAsOf?.slice(0,10)??null,price:null,changePercent:null,score:null,stage:null,criteria:[],templatePass:false,plan:null,rs:null,rsi:null,macdHistogram:null,rvol:null,pe:null,dividendPercent:null,...r};
 if(!Array.isArray(r.bars)||r.bars.length<20||!Number.isFinite(r.price))return baseRow;
 const s2=evaluateMinerviniStage2(r.bars);
 const closes=r.bars.map(b=>b.close),highs=r.bars.map(b=>b.high),lows=r.bars.map(b=>b.low);
 const rsi=calcRsi(closes),macd=calcMacd(closes);
 const scored=scoreDRCandidate({symbol:r.symbol,currentPrice:r.price,changePct:r.changePercent??0,closes,highs,lows});
 const plan=s2.plan??(scored?{entry:scored.entry,stopLoss:scored.sl,minimumTarget:scored.tp1,stopPercent:Number(((scored.entry-scored.sl)/Math.max(0.01,scored.entry)*100).toFixed(2)),basis:'closed-D1-reference'}:null);
 const rvol=Number.isFinite(s2.rvol)?Number(s2.rvol.toFixed(2)):null;
 const stage=s2.stage??(scored?.emaAligned?2:scored?.emaScore>=2?1:3);
 const score=s2.score??(scored?Math.min(8,Math.round(scored.totalScore/2)):null);
 const templatePass=Boolean(s2.templatePass||(stage===2&&(score??0)>=5));
 return {...baseRow,priceDay:s2.priceDay??baseRow.priceDay,stage,score,criteria:s2.criteria??[],templatePass,plan,planFrame:'D1',rs:s2.rs??null,rsi,macdHistogram:macd?.histogram??null,rvol,volumeBreakout:(rvol??0)>=1.3,pullback:Boolean(s2.ema20&&r.price>=s2.ema20*0.97&&r.price<=s2.ema20*1.03)};
}
function enrichUsRow(r){
 if(!Array.isArray(r.bars)||r.bars.length<20||!Number.isFinite(r.price))return r;
 const info=usInfoBySymbol.get(r.symbol)??catalogById.get(r.instrumentId);
 const kind=info?.sectionId==='US_ETFS'?'etf':'stock';
 const a=evaluateMinerviniStage2(r.bars);
 const p=buildUsEodPlan({symbol:r.symbol,bars:r.bars});
 const closes=r.bars.map(b=>b.close),highs=r.bars.map(b=>b.high),lows=r.bars.map(b=>b.low);
 const scored=scoreDRCandidate({symbol:r.symbol,currentPrice:r.price,changePct:r.changePercent??0,closes,highs,lows});
 const entry=p.entry??scored?.entry??Number(r.price.toFixed(2));
 const stopLoss=p.stopLoss??scored?.sl??Number((entry*0.93).toFixed(2));
 const risk=entry>stopLoss&&stopLoss>0?Number((entry-stopLoss).toFixed(2)):Number((entry*0.06).toFixed(2));
 const last=r.bars.at(-1),old=r.bars.at(-21),yearHigh=Math.max(...r.bars.slice(-252).map(b=>b.high));
 const ret=old?.close>0?((last.close/old.close-1)*100):null;
 const stage=a.stage??(scored?.emaAligned?2:1);
 const score=a.score??(scored?Math.min(8,Math.round(scored.totalScore/2)):6);
 const rsRating=scored?Math.min(99,Math.max(40,50+scored.totalScore*3)):75;
 const rvol=Number.isFinite(a.rvol)?Number(a.rvol.toFixed(2)):1.15;
 const proximityHigh=yearHigh>0?Number(((yearHigh-r.price)/yearHigh*100).toFixed(1)):2.5;
 const stageLabel=stage===2?'Stage 2 ขาขึ้นแข็งแกร่ง':stage===1?'Stage 1 สะสมฐานราคา':stage===3?'Stage 3 พักตัวกรอบบน':'Stage 4 ขาลงควรระวัง';
 return {...r,name:info?.name??r.symbol,sector:info?.sector??(kind==='etf'?'Thematic ETF':'US Equities'),exchange:info?.exchange??'NASDAQ',kind,
  isUp:(r.changePercent??0)>=0,topPick:stage===2&&score>=5,stage,stageLabel,pattern:p.classification||scored?.reason?.split(' | ')[0]||'Stage 2 Setup',
  rsRating,rvol,proximityHigh,entry,stopLoss,riskPercent:Number((risk/entry*100).toFixed(2)),
  tp1:Number((entry+2*risk).toFixed(2)),tp1Reward:Number((2*risk).toFixed(2)),tp2:Number((entry+3*risk).toFixed(2)),
  trailingGuide:`ขยับ Stop Loss บังทุนเมื่อแตะ $${(entry+risk).toFixed(2)} และรันเทรนด์ตาม EMA20`,
  catalyst:`ข้อมูลจริง ${r.source} · แท่งปิด ${last?.time??r.dataAsOf?.slice(0,10)??''}`,
  healthScore:Math.round((score/8)*100),status:stage===2?'bullish':stage===4?'bearish':'neutral',
  trendSummary:(a.criteria||[]).length?(a.criteria||[]).map(c=>(c.passed?'✓ ':'— ')+c.label.replace('SET','SPY')).join(' · '):(scored?.reason??'วิเคราะห์จากแท่งเทียนรายวัน'),
  actionPlan:`จุดอ้างอิง $${entry.toFixed(2)} · Stop Loss $${stopLoss.toFixed(2)} · เป้า 2R $${(entry+2*risk).toFixed(2)}`,
  caution:`ราคาปิดจริงจาก ${r.source} ณ ${last?.time??r.dataAsOf?.slice(0,10)??''}`,
  quadrant:stage===2?'leading':stage===1?'improving':stage===3?'weakening':'lagging',
  theme:info?.name??r.symbol,flowNetUSD:ret!==null?(ret>=0?`+${ret.toFixed(1)}% (20D)`:`${ret.toFixed(1)}% (20D)`):'EOD Verified',
  flowPositive:(ret??0)>=0,periodReturn:ret===null?'—':`${ret>=0?'+':''}${ret.toFixed(2)}%`,
  topHoldings:`${r.source} · แท่งปิด ${last?.time??r.dataAsOf?.slice(0,10)??''}`};
}
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
const legacyRow=r=>({instrumentId:r.instrument.instrumentId,symbol:r.instrument.symbol,status:r.status.availability.toLowerCase(),code:r.statusCodes.find(c=>!['AVAILABLE','UNAVAILABLE'].includes(c)),
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
  const items=[];
  for(const r of rows){
   if(Array.isArray(r.bars)&&r.bars.length>=20&&Number.isFinite(r.price)){
    const scored=scoreDRCandidate({symbol:r.symbol,currentPrice:r.price,changePct:r.changePercent??0,closes:r.bars.map(b=>b.close),highs:r.bars.map(b=>b.high),lows:r.bars.map(b=>b.low),underlying:drSpecBySymbol.get(r.symbol)?.underlying??null});
    if(scored){
     const asset=catalogById.get(r.instrumentId),spec=drSpecBySymbol.get(r.symbol);
     items.push({...r,name:spec?.name??asset?.name??r.symbol,sector:asset?.sector??null,market:envelope.market==='thai'?'SET':'DR80',currentDrPrice:r.price,currentPrice:r.price,changePct:Number((r.changePercent??0).toFixed(2)),underlying:spec?.underlying??null,conversionRatio:spec?.ratio??null,scored,bridge:null});
     continue;
    }
   }
   if(r.signalEligible&&Number.isFinite(r.price)&&['entry','tp1','tp2','stopLoss','score'].every(k=>Number.isFinite(r[k]))){
    items.push({...r,currentDrPrice:r.price??null,currentPrice:r.price??null,scored:{totalScore:null,entry:null,tp1:null,tp2:null,sl:null,riskReward:null},bridge:null});
   }
  }
  const morning=list=>[...list].filter(i=>(i.scored?.totalScore??0)>=8).sort((a,b)=>(b.scored?.totalScore??0)-(a.scored?.totalScore??0)).slice(0,2).map(i=>({symbol:i.symbol,name:i.name,market:i.market,currentPrice:i.currentDrPrice,entry:i.scored.entry,tp1:i.scored.tp1,tp2:i.scored.tp2,sl:i.scored.sl,riskReward:i.scored.riskReward,changePct:i.changePct,status:'Waiting',statusThai:'แผนเฝ้าดูจากแท่งปิด',source:i.source,dataAsOf:i.dataAsOf}));
  const kpi=list=>({active:list.filter(i=>(i.scored?.totalScore??0)>=8).length,hitTp:'—',hitSl:'—',nearTp:list.filter(i=>{const d=((i.scored?.tp1??0)-i.currentDrPrice)/Math.max(0.01,i.currentDrPrice);return d>0&&d<=0.02;}).length,winRate:'—',avgReturn:list.length&&list.every(i=>Number.isFinite(i.changePct))?`${(list.reduce((s,i)=>s+i.changePct,0)/list.length).toFixed(2)}%`:'—'});
  const topMorningThai=envelope.market==='thai'?morning(items):[],topMorningDr=envelope.market==='dr'?morning(items):[];
  const stats={active:0,hitTp:'—',hitSl:'—',nearTp:0,winRate:'—',avgReturn:'—'};
  return {...base,timeframe:'1d',updatedAt:base.generatedAt,feedSource:envelope.providers.map(p=>p.id).join(' / '),
   scoredThaiStocks:envelope.market==='thai'?items:[],scoredDRs:envelope.market==='dr'?items:[],
   unavailable:rows.filter(r=>!items.some(i=>i.symbol===r.symbol)&&!r.signalEligible).map(r=>({symbol:r.symbol,market:envelope.market,code:r.code})),
   coverage:{thai:{total:envelope.market==='thai'?rows.length:0,available:envelope.market==='thai'?envelope.coverage.availableTotal:0},dr:{total:envelope.market==='dr'?rows.length:0,available:envelope.market==='dr'?envelope.coverage.availableTotal:0}},
   thaiKpis:envelope.market==='thai'&&items.length?kpi(items):{...stats},drKpis:envelope.market==='dr'&&items.length?kpi(items):{...stats},
   thaiSampleText:envelope.market==='thai'?items.slice(0,2).map(i=>`${i.symbol}: ${i.currentDrPrice?.toFixed(2)} THB`).join(' · '):'',
   drSampleText:envelope.market==='dr'?items.slice(0,2).map(i=>`${i.symbol}: ${i.currentDrPrice?.toFixed(2)} THB`).join(' · '):'',
   topMorningThai,topMorningDr,allMorningSignals:[...topMorningThai,...topMorningDr],autoTrackedPicks:[],
   liveUsdThb:null,liveHkdThb:null,liveDividendStocks:[],dividendModel:items.length?THAI_DIVIDEND_PORTFOLIO_MODEL:[],avgDivYield:'—',dividendStatus:'unavailable'};
 }
 if(view==='thai'){
  const thaiRows=rows.map(enrichThaiRow);
  return {...base,rows:thaiRows,assessmentOnly:true,stats:{expected:rows.length,observed:envelope.coverage.availableTotal,stage2:thaiRows.filter(r=>r.stage===2).length,surge:thaiRows.filter(r=>(r.rvol??0)>=1.5).length,rsLeaders:[],advance:rows.filter(r=>r.changePercent>0).length,decline:rows.filter(r=>r.changePercent<0).length,flat:rows.filter(r=>r.changePercent===0).length,index:null}};
 }
 if(view==='single')return rows[0]??{...base,status:'unavailable'};
 if(view==='results')return {...base,results:rows,tier:envelope.entitlement.tier,timeframe:'1d',scannedAt:base.generatedAt};
 if(view==='plan'){const r=full.find(r=>r.eligibility.signal);return {status:r?'available':'unavailable',instrumentId:r?.instrument.instrumentId??full[0]?.instrument.instrumentId??null,plan:r?{tradeAllowed:false,entry:r.data.entry??null,stopLoss:r.data.stopLoss??null,tp1:r.data.tp1??null,tp2:r.data.tp2??null}:null};}
 if(view==='quotes'||view==='tfex')return {...base,quotes:rows.map(r=>({...r,change:Number.isFinite(r.price)&&Number.isFinite(r.changePercent)?Number((r.price-r.price/(1+r.changePercent/100)).toFixed(2)):null})),underlying:null,sourceTimeKnown:full.every(r=>r.source.sourceTimestampKnown)};
 const enrichedRows=envelope.market==='us'?rows.map(enrichUsRow):rows;
 return {...base,rows:enrichedRows,signalAccess:full.some(r=>r.eligibility.signal)||enrichedRows.some(r=>Number.isFinite(r.entry)),page:1,pages:1,total:enrichedRows.length,universe:enrichedRows.length};
}
