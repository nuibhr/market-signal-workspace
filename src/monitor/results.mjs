import {recordedOutcome,summarizeRecordedTrades} from '../auto-pick/signal-performance.mjs';
export const STRATEGIES=['all','swing','orb','eod','scalp'];
export const RESULT_STATES=['all','WAITING','OPEN','RUNNER','CLOSED','STOP','EXPIRED','REVIEW'];
export const RESULT_SCOPES=['closed','waiting','tracking','review','history'];
export const RESULT_SCOPE_STATES={waiting:['WAITING','WAITING_FOR_ENTRY'],tracking:['OPEN','RUNNER'],review:['EXPIRED','REVIEW','AMBIGUOUS']};
export function legacyStrategy(plan) {
 const setup=plan?.setupType??plan?.strategy;
 return ['OPENING_RANGE_BREAKOUT','DR_ORB_15M'].includes(setup)?'orb':['DAILY_CLOSE_BREAKOUT','US_EOD'].includes(setup)?'eod':'legacy';
}
export const resultStatus=s=>({WAITING_FOR_ENTRY:'WAITING',TARGET:'CLOSED',EXIT:'CLOSED',AMBIGUOUS:'REVIEW'})[s]??s;
const iso=ms=>Number.isFinite(ms)&&ms>0?new Date(ms).toISOString():null;
const validDates=r=>Number.isFinite(Date.parse(r.enteredAt))&&Number.isFinite(Date.parse(r.exitedAt))&&Date.parse(r.exitedAt)>=Date.parse(r.enteredAt);
export function projectTrade(raw,ledger) {
 const day=ledger==='daytrade',swing=ledger==='swing';
 const fills=swing?(raw.fills??[]):[];
 const fraction=fills.reduce((n,f)=>n+f.fraction,0);
 const row={id:raw.id,key:`${ledger}:${raw.id}`,ledger,strategy:swing?'swing':day?'scalp':legacyStrategy(raw.plan),market:raw.market,symbol:raw.symbol,
  status:resultStatus(raw.status),publishedAt:day?iso(raw.publishedAt):raw.publishedAt,
  enteredAt:day?iso(raw.entryTime*1000):raw.enteredAt,exitedAt:day?iso(raw.exitTime*1000):raw.exitedAt,
  entryPrice:day?raw.plan?.entry:raw.entryPrice,exitPrice:day?raw.exit:swing&&fraction>0?fills.reduce((n,f)=>n+f.price*f.fraction,0)/fraction:raw.exitPrice,
  plan:{side:raw.side??raw.plan?.side??'LONG',entry:day?raw.plan?.entry??raw.trigger:raw.plan?.entry,stopLoss:day?raw.plan?.stop??raw.stop:raw.originalPlan?.stopLoss??raw.plan?.stopLoss,tp1:day?raw.plan?.target:raw.plan?.minimumTarget??raw.plan?.tp1},
  costBasis:ledger==='legacy'?'before-costs':'configured-reference-costs',outcome:null};
 if(swing||day){
  if(['CLOSED','STOP'].includes(row.status)&&Number.isFinite(raw.netR)&&row.entryPrice>0&&row.exitPrice>0&&validDates(row)){
   const risk=swing?raw.plan?.netRiskPerUnit:raw.plan?.risk;
   const basis=swing?raw.plan?.entryBasis:row.entryPrice;
   if(Number.isFinite(risk)&&risk>0&&basis>0)row.outcome={rMultiple:raw.netR,returnPercent:raw.netR*risk/basis*100};
  }
 }else row.outcome=recordedOutcome(raw);
 if(['CLOSED','STOP'].includes(row.status)&&!row.outcome)row.status='REVIEW';
 return row;
}
export const resultOutcome=row=>row.outcome??null;
export function combineResults(parts,{page=1,pageSize=7,scope='history',status='all',tradeKey=null}={}) {
 const date=r=>Date.parse(scope==='closed'?r.exitedAt:r.publishedAt)||0;
 const unique=rows=>[...new Map(rows.map(r=>[r.key,r])).values()];
 const sort=rows=>rows.sort((a,b)=>date(b)-date(a)||a.key.localeCompare(b.key));
 const closed=unique(parts.flatMap(p=>p.closed??[])).filter(r=>r.outcome).sort((a,b)=>Date.parse(b.exitedAt)-Date.parse(a.exitedAt)||a.key.localeCompare(b.key)).slice(0,100);
 const trades=closed.map(r=>({...r,...r.outcome}));
 const rows=scope==='closed'?closed.filter(r=>status==='all'||r.status===status):sort(unique(parts.flatMap(p=>p.rows)));
 const total=scope==='closed'?rows.length:parts.reduce((n,p)=>n+p.total,0);
 const selectedIndex=scope==='closed'&&tradeKey?rows.findIndex(r=>r.key===tradeKey):-1;
 const pages=Math.max(1,Math.ceil(total/pageSize)),current=selectedIndex>=0?Math.floor(selectedIndex/pageSize)+1:Math.max(1,Math.min(page,pages));
 const counts={};for(const part of parts)for(const [status,n] of Object.entries(part.counts??{}))counts[resultStatus(status)]=(counts[resultStatus(status)]??0)+n;
 return {status:'available',signals:rows.slice((current-1)*pageSize,current*pageSize),total,page:current,pageSize,scope,counts,selectedKey:selectedIndex>=0?rows[selectedIndex].key:null,
  summary:{...summarizeRecordedTrades(trades),entered:parts.reduce((n,p)=>n+(p.entered??0),0)},recentTrades:trades,
  sources:parts.map(p=>({ledger:p.ledger,status:p.status??'available'}))};
}
