import { thaiEquityTick } from '../analysis/thai-tick.mjs';
import { canLong, canShort } from './universe.mjs';
import { nativeTradingDay } from './calendar.mjs';

// One versioned, price-only research rule. Volume confirmation is a separate input.
export const RULE = 'daytrade-trend-15m-v1';
export const SETTINGS = Object.freeze({ warmup:60, atr:14, minimumStopATR:1.5, structureBars:8,
  structureBufferATR:0.25, maximumStopATR:4, targetR:2, maximumHoldingBars:16, cooldownBars:4 });
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function cleanBars(input, now = Date.now()) {
  const rows = new Map(), duplicate = new Set();
  for (const b of input || []) {
    if (!Number.isSafeInteger(b.time) || b.time <= 0 || (b.time+900)*1000 > now ||
      ![b.open,b.high,b.low,b.close].every(n=>finite(n)&&n>0) ||
      b.low > Math.min(b.open,b.close) || b.high < Math.max(b.open,b.close) || b.low > b.high) continue;
    if (rows.has(b.time)) { rows.delete(b.time); duplicate.add(b.time); }
    if (!duplicate.has(b.time)) rows.set(b.time,b);
  }
  return [...rows.values()].sort((a,b)=>a.time-b.time);
}
function ema(rows, period) {
  let value=rows[0].close;
  return rows.map(b => (value=b.close*2/(period+1)+value*(1-2/(period+1))));
}
export function features(bars) {
  const fast=ema(bars,20), slow=ema(bars,50); let atr=0;
  const volatility=bars.map((b,i)=>{
    const tr=Math.max(b.high-b.low, i?Math.abs(b.high-bars[i-1].close):0, i?Math.abs(b.low-bars[i-1].close):0);
    atr=i<14 ? (atr*i+tr)/(i+1) : (atr*13+tr)/14;
    return atr;
  });
  return {fast,slow,volatility};
}
export function roundPrice(price, asset, direction) {
  const step=['thai','dr'].includes(asset.market) ? thaiEquityTick(price) : asset.point;
  if (!(step>0)) return null;
  return Number(((direction==='up'?Math.ceil:Math.floor)(price/step+(direction==='up'?-1e-8:1e-8))*step).toFixed(10));
}
function localSession(asset, seconds, offsetMinutes=0) {
  const shifted=new Date((seconds+offsetMinutes*60)*1000);
  const date=shifted.toISOString().slice(0,10), minute=shifted.getUTCHours()*60+shifted.getUTCMinutes();
  if(asset.market==='us') {
    const c=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
    const m=Number(c.hour)*60+Number(c.minute);
    return {key:`${c.year}-${c.month}-${c.day}`, open:![0,6].includes(new Date(seconds*1000).getUTCDay())&&m>=570&&m<960, last:m>=945};
  }
  if(['thai','dr','tfex'].includes(asset.market)) {
    const d=new Date((seconds+7*3600)*1000), m=d.getUTCHours()*60+d.getUTCMinutes(), day=d.toISOString().slice(0,10);
    // Day session only, including TFEX; night sessions are deliberately outside v1.
    const close=asset.market==='tfex'?1015:990;
    const start=asset.market==='tfex'?585:600;
    return {key:day,open:!nativeTradingDay(seconds).closedReason&&((m>=start&&m<750)||(m>=840&&m<close)),last:(m<750&&m+15>=750)||m+15>=close};
  }
  if(asset.session?.intervals?.length){
    const minuteOf=text=>{const [h,m]=text.split(':').map(Number);return h*60+m;};
    const interval=asset.session.intervals.find(s=>s.day===shifted.getUTCDay()&&minute>=minuteOf(s.open)&&minute+15<=minuteOf(s.close));
    return {key:date,open:Boolean(interval),last:interval?minute+30>minuteOf(interval.close):false};
  }
  return {key:date,open:![0,6].includes(shifted.getUTCDay())&&minute>=15&&minute<1425,last:minute>=1410};
}
export function setupAt(asset,bars,i,values=features(bars),offset=0) {
  if(i<SETTINGS.warmup-1)return null;
  if(['us','forex'].includes(asset.market) && ![1,2,4].includes(asset.trade_mode))return null;
  const b=bars[i], p=bars[i-1], session=localSession(asset,b.time,offset);
  if(!session.open||session.last)return null;
  const {fast,slow,volatility}=values, a=volatility[i];
  if(!(a>0) || b.volume===0 || b.time-p.time!==900 || b.high-b.low>3*a)return null;
  const up=canLong(asset)&&fast[i]>slow[i]&&slow[i]>slow[i-4]&&b.close>fast[i];
  const down=canShort(asset)&&fast[i]<slow[i]&&slow[i]<slow[i-4]&&b.close<fast[i];
  const side=up&&b.close>b.open&&b.close>p.high ? 'LONG' : down&&b.close<b.open&&b.close<p.low ? 'SHORT' : null;
  if(!side)return null;
  const long=side==='LONG', prior=bars.slice(i-SETTINGS.structureBars+1,i+1);
  const structure=long?Math.min(...prior.map(x=>x.low)):Math.max(...prior.map(x=>x.high));
  const raw=long?Math.min(structure-0.25*a,b.close-1.5*a):Math.max(structure+0.25*a,b.close+1.5*a);
  const stop=roundPrice(raw,asset,long?'down':'up');
  if(!(stop>0)||Math.abs(b.close-stop)>4*a)return null;
  return {rule:RULE,side,signalTime:b.time,availableAt:b.time+900,atr:a,stop,
    trigger:b.close, sessionKey:session.key,offsetMinutes:offset,reason:'แนวโน้ม EMA20/50 · แท่ง 15m ปิดผ่านแท่งก่อนหน้า'};
}
export function entryPlan(asset,setup,open,{spread=0,slippageBps=0,feeBps=0}={}) {
  if(setup.side==='LONG'?!canLong(asset):!canShort(asset))return null;
  if(![open,spread,slippageBps,feeBps].every(finite)||open<=0||spread<0||slippageBps<0||feeBps<0)return null;
  const direction=setup.side==='LONG'?1:-1;
  const friction=(direction>0?spread:0)+open*slippageBps/10000;
  const entry=roundPrice(open+direction*friction,asset,direction>0?'up':'down');
  const risk=direction*(entry-setup.stop);
  if(!(risk>=1.5*setup.atr)||risk>4*setup.atr||risk<spread*3)return null;
  const target=roundPrice(entry+direction*2*risk,asset,direction>0?'up':'down');
  if(!(target>0))return null;
  return {entry,stop:setup.stop,target,risk,spread,slippageBps,feeBps,costsEstimated:true};
}
export function exitOnBar(asset,trade,b,previousTime) {
  const long=trade.side==='LONG', dir=long?1:-1, p=trade.plan;
  // No inference across a missing interval, overnight or lunch break.
  if(previousTime!==null&&b.time!==previousTime+900)return {status:'REVIEW',reason:'DATA_GAP'};
  if(b.volume===0)return null; // An empty provider bucket proves no tradable observation.
  const ask=long?0:p.spread, open=b.open+ask,high=b.high+ask,low=b.low+ask;
  const stopHit=long?low<=p.stop:high>=p.stop, targetHit=long?high>=p.target:low<=p.target;
  const stopGap=long?open<=p.stop:open>=p.stop;
  const targetGap=long?open>=p.target:open<=p.target;
  if(stopHit&&targetHit&&!stopGap&&!targetGap)return {status:'REVIEW',reason:'AMBIGUOUS_TP_SL'};
  const s=localSession(asset,b.time,trade.offsetMinutes);
  let exit=null,reason=null;
  if(stopGap){exit=open;reason='SL_GAP';}
  else if(targetGap){exit=p.target;reason='TP';}
  else if(stopHit){exit=p.stop;reason='SL';}
  else if(targetHit){exit=p.target;reason='TP';}
  else if(s.key!==trade.sessionKey)return {status:'REVIEW',reason:'SESSION_CLOSE_MISSING'};
  else if(s.last||trade.heldBars>=SETTINGS.maximumHoldingBars){exit=b.close+ask;reason=s.last?'SESSION_END':'TIME_EXIT';}
  if(exit===null)return null;
  // MT5 bars are bid based: the short exit pays the recorded spread. Slippage
  // is adverse on all exits. Historical spreads must be supplied by the caller.
  exit-=dir*exit*p.slippageBps/10000;
  const fee=(p.entry+exit)*p.feeBps/10000;
  return {status:'CLOSED',reason,exit,exitTime:b.time+900,netR:(dir*(exit-p.entry)-fee)/p.risk};
}
export function replayDaytrade(asset,input,{now=Date.now(),offsetMinutes=0,costs={}}={}) {
  const bars=cleanBars(input,now), values=bars.length?features(bars):null;
  const trades=[]; let active=null,pending=null,cooldown=0;
  for(let i=0;i<bars.length;i++) {
    const b=bars[i];
    if(pending&&!active){
      if(b.volume!==0&&b.time===pending.availableAt&&localSession(asset,b.time,offsetMinutes).key===pending.sessionKey){
        const plan=entryPlan(asset,pending,b.open,costs);
        if(plan)active={...pending,id:`${RULE}:${asset.instrumentId}:${pending.signalTime}`,symbol:asset.symbol,
          plan,entryTime:b.time,heldBars:0,lastBar:null,status:'OPEN',origin:'replay'};
      }
      pending=null;
    }
    if(active){
      active.heldBars++;
      const result=exitOnBar(asset,active,b,active.lastBar);
      active.lastBar=b.time;
      if(result){trades.push({...active,...result});active=null;cooldown=SETTINGS.cooldownBars;}
      continue;
    }
    if(cooldown>0){cooldown--;continue;}
    pending=setupAt(asset,bars,i,values,offsetMinutes);
  }
  return {rule:RULE,bars:bars.length,from:bars[0]?.time??null,to:bars.at(-1)?.time??null,
    trades,open:active,pending,summary:summarize(trades)};
}
export function summarize(trades) {
  const closed=trades.filter(t=>t.status==='CLOSED'&&finite(t.netR));
  const wins=closed.filter(t=>t.netR>0), losses=closed.filter(t=>t.netR<0);
  const gain=wins.reduce((s,t)=>s+t.netR,0),loss=-losses.reduce((s,t)=>s+t.netR,0);
  let equity=0,peak=0,drawdown=0;
  for(const t of [...closed].sort((a,b)=>a.exitTime-b.exitTime)){equity+=t.netR;peak=Math.max(peak,equity);drawdown=Math.max(drawdown,peak-equity);}
  return {closed:closed.length,wins:wins.length,losses:losses.length,review:trades.filter(t=>t.status==='REVIEW').length,
    winRate:closed.length?wins.length/closed.length*100:null,netR:equity,averageR:closed.length?equity/closed.length:null,
    profitFactor:loss>0?gain/loss:null,maxDrawdownR:drawdown};
}
