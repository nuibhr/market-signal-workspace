import {closedAvailable,signalPlan} from '../signals/model.mjs';
import {confirmedSwings} from '../backtest/swing-replay.mjs';
import {atr14} from './chart-levels.mjs';
// User-requested EMA adaptation; independently implemented, not the original
// SMA template. Assessment only: this never opens or modifies a ledger trade.
export const STAGE2_RULE='thai-ema-stage2-context-v1';
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function emaSeries(values,period){
 let current=null;
 return values.map((v,i)=>{if(i===period-1)current=values.slice(0,period).reduce((a,b)=>a+b,0)/period;else if(i>=period)current+=(v-current)*2/(period+1);return current;});
}
export function relativeStrength(stock,index,{lookback=63}={}){
 const byDay=new Map(index.map(b=>[b.time,b.close]));
 if(!stock.length||!byDay.has(stock.at(-1).time))return {status:'unavailable',code:'BENCHMARK_NOT_ALIGNED',excessReturnPercent:null};
 const calendar=[...byDay.keys()].filter(day=>day<=stock.at(-1).time).sort().slice(-lookback-1),prices=new Map(stock.map(b=>[b.time,b.close]));
 if(calendar.length<lookback+1)return {status:'unavailable',code:'RS_HISTORY_INCOMPLETE',excessReturnPercent:null};
 if(calendar.some(day=>!positive(prices.get(day))))return {status:'unavailable',code:'RS_CALENDAR_GAP',excessReturnPercent:null};
 const pairs=calendar.map(day=>({day,stock:prices.get(day),index:byDay.get(day)}));
 const first=pairs.at(-lookback-1),last=pairs.at(-1);
 const excessReturnPercent=((last.stock/first.stock)/(last.index/first.index)-1)*100;
 return {status:'available',benchmark:'SET',lookback,from:first.day,to:last.day,excessReturnPercent,outperforming:excessReturnPercent>0};
}
export function stage2RiskPlan(bars,costs){
 const swings=confirmedSwings(bars),atr=atr14(bars);
 if(!swings.lows.length||!positive(atr)||!costs)return null;
 const plan=signalPlan({market:'thai',swingLow:swings.lows.at(-1),atr,resistanceLevels:swings.highs},bars.at(-1).close,costs);
 return plan.signalEligible?{...plan,basis:'closed-D1-reference'}:null;
}
export function evaluateMinerviniStage2(dailyInput,{benchmarkBars=[],now=Date.now(),costs=null}={}){
 const invalid=!Array.isArray(dailyInput)||dailyInput.some(b=>!/^\d{4}-\d{2}-\d{2}$/.test(String(b.time))||![b.open,b.high,b.low,b.close].every(positive)||!Number.isFinite(b.volume)||b.volume<0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close));
 if(invalid||new Set(dailyInput.map(b=>b.time)).size!==dailyInput.length)return {ruleVersion:STAGE2_RULE,status:'unavailable',code:'INVALID_DAILY_BARS',stage:null,criteria:[],score:null};
 const bars=closedAvailable([...dailyInput].sort((a,b)=>a.time.localeCompare(b.time)),'1d','thai',now);
 if(bars.length<220){
  const last=bars.at(-1),stale=last&&now-Date.parse(`${last.time}T17:15:00+07:00`)>8*86400000;
  const mean=bars.length>=21?bars.slice(-21,-1).reduce((s,b)=>s+b.volume,0)/20:0;
  return {ruleVersion:STAGE2_RULE,status:stale?'stale':last?'partial':'unavailable',code:stale?'STALE_DAILY_BARS':'NEED_220_CLOSED_DAYS',stage:null,criteria:[],score:null,historyDays:bars.length,
   price:last?.close??null,priceDay:last?.time??null,changePercent:bars.length>1?(last.close/bars.at(-2).close-1)*100:null,rvol:mean>0?last.volume/mean:null,
   rs:{status:'unavailable',excessReturnPercent:null},templatePass:false,templateComplete:false,referenceOnly:true};
 }
 const closes=bars.map(b=>b.close),ema20=emaSeries(closes,20).at(-1),ema50=emaSeries(closes,50).at(-1),ema150=emaSeries(closes,150).at(-1),series200=emaSeries(closes,200),ema200=series200.at(-1),past=series200.at(-21),price=closes.at(-1);
 const rising=ema200>=past-1e-10,fullYear=bars.length>=252,year=bars.slice(-252),low=Math.min(...year.map(b=>b.low)),high=Math.max(...year.map(b=>b.high));
 const validIndex=benchmarkBars.filter(b=>/^\d{4}-\d{2}-\d{2}$/.test(String(b.time))&&positive(b.close));
 const rs=relativeStrength(bars,closedAvailable(validIndex,'1d','thai',now));
 const criteria=[
  ['ราคา > EMA150 และ EMA200',price>ema150&&price>ema200],['EMA150 > EMA200',ema150>ema200],
  ['EMA200 ทรงตัว/ขึ้นเทียบ 20 วัน',rising],['EMA50 > EMA150 > EMA200',ema50>ema150&&ema150>ema200],
  ['ราคา > EMA50',price>ema50],['สูงกว่า Low 52 สัปดาห์ ≥30%',fullYear?price>=low*1.30:null],
  ['ห่าง High 52 สัปดาห์ ≤25%',fullYear?price>=high*.75:null],['RS 63 วันแข็งกว่า SET',rs.status==='available'?rs.outperforming:null],
 ].map(([label,passed],i)=>({id:i+1,label,passed}));
 const stage=price>ema50&&ema50>ema150&&ema150>ema200&&rising?2:price<ema200&&ema50<ema200&&!rising?4:price<ema50&&ema50>ema200?3:1;
 const score=criteria.filter(c=>c.passed===true).length,complete=criteria.every(c=>c.passed!==null);
 const stale=now-Date.parse(`${bars.at(-1).time}T17:15:00+07:00`)>8*86400000;
 const volumeMean=bars.slice(-21,-1).reduce((s,b)=>s+b.volume,0)/20;
 return {ruleVersion:STAGE2_RULE,status:stale?'stale':complete?'available':'partial',code:stale?'STALE_DAILY_BARS':!fullYear?'NEED_252_DAYS':rs.code??null,
  historyDays:bars.length,price,priceDay:bars.at(-1).time,changePercent:(price/closes.at(-2)-1)*100,ema20,ema50,ema150,ema200,
  stage,score,criteria,templateComplete:complete,templatePass:!stale&&complete&&stage===2&&score>=7&&rs.outperforming===true,
  rs,yearLow:fullYear?low:null,yearHigh:fullYear?high:null,rvol:volumeMean>0?bars.at(-1).volume/volumeMean:null,
  plan:stale?null:stage2RiskPlan(bars,costs),referenceOnly:true};
}
