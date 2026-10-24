import {getUsDailyBars} from './us-eod.mjs';
import {evaluateMinerviniStage2} from '../analysis/minervini-stage2.mjs';
import {buildUsEodPlan} from '../auto-pick/us-engine.mjs';
import {US_STOCKS,US_ETFS} from '../markets/catalog.mjs';
const cache=new Map(),pending=new Map();
export const US_FOCUS_SYMBOLS=['NVDA','PLTR','AAPL','MSFT','META','AMZN','AVGO','TSLA','GOOGL','LLY'];
export const US_ROTATION_SYMBOLS=['SMH','QQQ','CIBR','XLE','IWM','WCLD','SPY','XLV','XLF','ICLN'];
const etfs=new Set([...US_ETFS.map(a=>a.symbol),...US_ROTATION_SYMBOLS]);
export async function usDeskSymbol(symbol,{now=Date.now()}={}){
 const cached=cache.get(symbol);if(cached?.expires>now)return cached.value;
 if(pending.has(symbol))return pending.get(symbol);
 const job=(async()=>{
  const kind=etfs.has(symbol)?'etf':'stock';
  const series=await getUsDailyBars(symbol,{assetKind:kind});
  let benchmark;try{benchmark=await getUsDailyBars('SPY',{assetKind:'etf'});}catch{benchmark={bars:[]};}
  // Feed the existing project engines; no trading rules are changed here.
  const a=evaluateMinerviniStage2(series.bars,{benchmarkBars:benchmark.bars,now});
  const p=buildUsEodPlan({symbol,bars:series.bars});
  const info=[...US_STOCKS,...US_ETFS].find(v=>v.symbol===symbol),entry=p.entry??null,stopLoss=p.stopLoss??null;
  const risk=entry>stopLoss&&stopLoss>0?entry-stopLoss:null,last=series.bars.at(-1),old=series.bars.at(-21);
  const change=series.bars.length>1?(last.close/series.bars.at(-2).close-1)*100:null;
  const rs=a.rs?.excessReturnPercent??null,ret=old?.close>0?(last.close/old.close-1)*100:null;
  const value={symbol,name:info?.name||symbol,sector:info?.sector||kind,exchange:info?.exchange||'US',
   source:series.source,observedAt:last?.time,receivedAt:series.receivedAt,price:last?.close??null,changePercent:change,isUp:change>=0,
   topPick:a.templatePass&&risk!==null&&risk/entry<=.08,stage:a.stage,stageLabel:a.stage?'Stage '+a.stage:'รอข้อมูลครบ',pattern:p.classification||p.code,
   rsRating:rs===null?null:Number(rs.toFixed(2)),rvol:a.rvol===null?null:Number(a.rvol?.toFixed(2)),entry,stopLoss,
   riskPercent:risk===null?null:risk/entry*100,tp1:risk===null?null:entry+2*risk,tp1Reward:risk===null?null:2*risk,tp2:risk===null?null:entry+3*risk,
   trailingGuide:'TP1 2R แบ่งขาย 50% และติดตามส่วนที่เหลือตามกติกาเดิม',
   healthScore:a.score===null?'—':a.score/8*100,trendSummary:(a.criteria||[]).map(c=>(c.passed?'✓ ':'— ')+c.label.replace('SET','SPY')).join(' · '),
   actionPlan:p.blockers?.join(' · ')||'ติดตามจุดเข้า/Stop/เป้าหมายจากแท่ง D1',caution:'ราคาอ้างอิงแท่งปิด '+last?.time+' · '+series.source,
   criteria:a.criteria,templatePass:a.templatePass,historyDays:a.historyDays,kind,
   quadrant:a.stage===2?'leading':a.stage===4?'lagging':a.stage===3?'weakening':a.stage===1?'improving':'unknown',
   theme:info?.name||symbol,flowNetUSD:'ไม่มีข้อมูล Fund Flow',flowPositive:false,periodReturn:ret===null?'—':ret.toFixed(2)+'%',
   topHoldings:series.source+' · '+last?.time,status:a.status};
  cache.set(symbol,{value,expires:now+600000});return value;
 })().finally(()=>pending.delete(symbol));pending.set(symbol,job);return job;
}
export function usDeskCached(symbols){return symbols.every(s=>cache.get(s)?.expires>Date.now()||pending.has(s));}
export async function usDeskBatch(symbols){
 const rows=[];for(let i=0;i<symbols.length;i+=2){rows.push(...await Promise.all(symbols.slice(i,i+2).map(symbol=>usDeskSymbol(symbol).catch(error=>({symbol,status:'unavailable',code:error.code||'SOURCE_UNAVAILABLE'})))));}
 return rows;
}
