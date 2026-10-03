import { buildThaiOrbPlan, advanceThaiOrbPick } from './thai-orb.mjs';
import { buildDrOrbPlan, advanceDrOrbPick, drSession } from './dr-orb.mjs';
import { buildUsEodPlan, advanceUsEodPick } from './us-engine.mjs';
import { MAI_INITIAL_SYMBOLS } from '../markets/catalog.mjs';
import { bangkokParts } from './engine.mjs';

export function replayThreeMonths({ symbol, market, daily, intraday = [], now = Date.now() }) {
  daily = [...daily].sort((a,b)=>a.time.localeCompare(b.time));
  intraday = [...intraday].sort((a,b)=>a.time-b.time);
  const end = new Date(now); const startDate = new Date(now); startDate.setUTCMonth(startDate.getUTCMonth() - 3);
  const from = startDate.toISOString().slice(0,10); const to = end.toISOString().slice(0,10);
  const trades = []; let plans = 0, evaluated = 0;
  if (market === 'us') {
    let pick = null;
    for (let i = 50; i < daily.length; i++) {
      const bars = daily.slice(0,i+1); const day = bars.at(-1).time;
      if (day < from || day >= to) continue;
      evaluated++;
      if (pick) { pick = advanceUsEodPick(pick,bars).pick;
        if (!['OPEN','WAITING_FOR_ENTRY'].includes(pick.status)) { trades.push(pick); pick = null; } }
      if (!pick) { const plan = buildUsEodPlan({symbol,instrumentId:`US_STOCKS:${symbol}`,bars});
        if (plan.tradeAllowed) { plans++; pick = {plan,status:'WAITING_FOR_ENTRY',sessionDay:day,publishedAt:`${day}T23:59:59Z`}; } }
    }
    if (pick) trades.push(pick);
  } else {
    const days = [...new Set(intraday.map(b=>bangkokParts(b.time*1000).day))].filter(d=>d>=from&&d<to);
    for (const day of days) for (const sessionName of market === 'dr' ? ['day','night'] : ['day']) {
      const published = Date.parse(`${day}T${market==='thai'?'10:15':sessionName==='day'?'10:30':'20:00'}:00+07:00`);
      const session = drSession(published); if (market==='dr' && session.session!==sessionName) continue;
      const pre = intraday.filter(b=>(b.time+900)*1000<=published);
      const plan = market==='thai' ? buildThaiOrbPlan({symbol,instrumentId:`${MAI_INITIAL_SYMBOLS.includes(symbol)?'MAI_INITIAL':'SET100'}:${symbol}`,fifteenMinuteBars:pre,dailyBars:daily.filter(b=>b.time<day),now:published})
        : buildDrOrbPlan({symbol,fifteenMinuteBars:pre,dailyBars:daily.filter(b=>b.time<day),session,now:published});
      evaluated++; if (!plan.tradeAllowed) continue; plans++;
      let pick={plan,status:'WAITING_FOR_ENTRY',sessionDay:market==='thai'?day:session.key,publishedAt:new Date(published).toISOString()};
      const finish=market==='thai'?Date.parse(`${day}T12:45:00+07:00`):session.end*1000;
      for (const bar of intraday.filter(b=>(b.time+900)*1000>published&&(b.time+900)*1000<=finish)) {
        const clock=(bar.time+900)*1000; const available=intraday.filter(b=>(b.time+900)*1000<=clock);
        pick = market==='thai' ? advanceThaiOrbPick(pick,available,clock).pick
          : advanceDrOrbPick(pick,available,{price:bar.close,marketStatus:sessionName==='night'?'night':'day'},clock).pick;
        if (!['WAITING_FOR_ENTRY','OPEN'].includes(pick.status)) break;
      }
      trades.push(pick);
    }
  }
  const entered=trades.filter(t=>Number.isFinite(t.entryPrice));
  const closed=entered.filter(t=>['TARGET','STOP','EXIT'].includes(t.status)&&Number.isFinite(t.exitPrice));
  const wins=closed.filter(t=>t.exitPrice>t.entryPrice).length; const losses=closed.filter(t=>t.exitPrice<t.entryPrice).length;
  const oldest=market==='us'?daily[50]?.time:intraday[0]?bangkokParts(intraday[0].time*1000).day:null;
  const observedDays = new Set(intraday.map(b=>bangkokParts(b.time*1000).day));
  const missingDays = market==='us' ? [] : daily.filter(b=>b.time>=from&&b.time<to&&!observedDays.has(b.time)).map(b=>b.time);
  return {symbol,market,requestedFrom:from,requestedTo:to,availableFrom:oldest,missingDays,periodCovered:Boolean(oldest&&oldest<=from),coverageComplete:false,
    evaluatedSessions:evaluated,plans,entries:entered.length,closed:closed.length,wins,losses,breakeven:closed.length-wins-losses,
    unresolved:entered.length-closed.length,winRate:closed.length?wins/closed.length*100:null,
    coverageNote:market==='us'?'ประเมินจากแท่งรายวันที่มี · ยังไม่เทียบวันซื้อขายกับปฏิทินตลาด':'ยังไม่ยืนยันแท่งครบทุกช่วงระหว่างวันและสิทธิซื้อขาย DR ภาคค่ำในอดีต',
    model:market==='dr'?'DR OHLC replay · quote จำลองเท่าราคาปิด ไม่ใช่การทดสอบ quote จริง':'replay สูตรเดียวกับสัญญาณ · ใช้ข้อมูลถึงเวลานั้นเท่านั้น',
    note:'ก่อนค่าธรรมเนียมและ slippage · ไม่นับแผนที่ไม่เข้า/ข้อมูลขาด/แท่งแตะ TP และ SL พร้อมกัน · ไม่ใช่ผลซื้อขายลูกค้า',
    trades:entered.map(t=>({status:t.status,entry:t.entryPrice,exit:t.exitPrice,enteredAt:t.enteredAt,exitedAt:t.exitedAt}))};
}
