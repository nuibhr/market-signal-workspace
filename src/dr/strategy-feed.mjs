import YahooFinance from 'yahoo-finance2';
import { loadChartBackup } from '../market-data/chart-backup.mjs';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { nativeTradingDay } from '../daytrade/calendar.mjs';
import { ALL_ASSETS } from '../markets/catalog.mjs';
import { calcIndicativePrice, scoreDRCandidate, THAI_DIVIDEND_PORTFOLIO_MODEL } from './strategy-tracker.mjs';

const yf = new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,
  fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),queue:{concurrency:4}});
const native = createSettradeClient();
export async function loadScanSeries(asset, { env=process.env, client=native, backup=loadChartBackup, now=Date.now() }={}) {
  if (client.configuration.configured && (env.NODE_ENV!=='production'||env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED==='true')) {
    try {
      const series=await client.getCandles(asset.symbol,'1d',750);
      if(series.symbol!==asset.symbol||![`SET:${asset.symbol}`,asset.instrumentId].includes(series.instrumentId))throw Error('INSTRUMENT_MISMATCH');
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
      const closed=(series.bars??[]).filter(b=>typeof b.time==='string'&&b.time<day);
      if(series.freshness==='stale'||closed.at(-1)?.time!==expectedClosedDay(now))throw Error('STALE_NATIVE_SERIES');
      return {...series,instrumentId:asset.instrumentId};
    } catch { /* Use labelled closed historical bars if the native feed fails. */ }
  }
  return backup(asset,'1d');
}

// Official DR ratios checked on 2026-10-20; currency is that of the actual underlying listing.
export const DR_SPECS = [
  {symbol:'AAPL80',name:'Apple Inc. DR',underlying:'AAPL',ratio:1000,currency:'USD'},
  {symbol:'NVDA80',name:'NVIDIA Corp. DR',underlying:'NVDA',ratio:200,currency:'USD'},
  {symbol:'MSFT80',name:'Microsoft Corp. DR',underlying:'MSFT',ratio:2000,currency:'USD'},
  {symbol:'TSLA80',name:'Tesla Inc. DR',underlying:'TSLA',ratio:5000,currency:'USD'},
  {symbol:'BABA80',name:'Alibaba Group DR',underlying:'9988.HK',ratio:100,currency:'HKD'},
  {symbol:'TENCENT80',name:'Tencent Holdings DR',underlying:'0700.HK',ratio:100,currency:'HKD'},
].map(row=>({...row,ratioCheckedOn:'2026-10-20',ratioSource:`https://www.settrade.com/th/equities/dr/quote/${row.symbol}/overview`}));
export function expectedClosedDay(now) {
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  let ms=Date.parse(`${day}T00:00:00+07:00`);
  for(let n=0;n<14;n++){
    ms-=86400000;const calendar=nativeTradingDay(ms/1000);
    if(!calendar.calendarVerified)return null;
    if(!calendar.closedReason)return calendar.day;
  }
  return null;
}
const quoteTime=q=>q?.regularMarketTime instanceof Date?q.regularMarketTime.getTime():typeof q?.regularMarketTime==='number'?q.regularMarketTime*1000:Date.parse(q?.regularMarketTime);
export function comparableBridge(item,underlying,fx,drPrice,drAsOf,now) {
  const times=[quoteTime(underlying),quoteTime(fx),Date.parse(`${drAsOf}T17:00:00+07:00`)];
  if(!times.every(Number.isFinite)||times.some(t=>t>now)||Math.max(...times)-Math.min(...times)>15*60000)return null;
  if(![underlying.regularMarketPrice,fx.regularMarketPrice].every(positive))return null;
  const value=calcIndicativePrice({underlyingUsd:underlying.regularMarketPrice,usdThbRate:fx.regularMarketPrice,conversionRatio:item.ratio,currentDrPrice:drPrice});
  return value?{...value,currency:item.currency,underlyingAsOf:new Date(times[0]).toISOString(),fxAsOf:new Date(times[1]).toISOString(),drAsOf:new Date(times[2]).toISOString()}:null;
}

const THAI_SPECS = [
  { symbol: 'CPALL', name: 'บมจ.ซีพี ออลล์', sector: 'Commerce & Retail' },
  { symbol: 'BDMS', name: 'บมจ.กรุงเทพดุสิตเวชการ', sector: 'Healthcare & Hospital' },
  { symbol: 'ADVANC', name: 'บมจ.แอดวานซ์ อินโฟร์ เซอร์วิส', sector: 'Telecom & Tech' },
  { symbol: 'GULF', name: 'บมจ.กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์', sector: 'Energy & Utilities' },
  { symbol: 'PTT', name: 'บมจ.ปตท.', sector: 'Energy & Utilities' },
  { symbol: 'DELTA', name: 'บมจ.เดลต้า อีเลคโทรนิคส์ (ประเทศไทย)', sector: 'Tech & Electronics' },
  { symbol: 'KBANK', name: 'ธนาคารกสิกรไทย', sector: 'Banking & Financials' },
  { symbol: 'SCB', name: 'บมจ.เอสซีบี เอกซ์', sector: 'Banking & Financials' },
];

const positive = n => typeof n==='number' && Number.isFinite(n) && n>0;
const summary = items => ({active:items.filter(i=>i.scored.totalScore>=8).length,
  hitTp:'—',hitSl:'—',nearTp:items.filter(i=>{const d=(i.scored.tp1-i.currentDrPrice)/i.currentDrPrice;return d>0&&d<=0.02;}).length,
  winRate:'—',avgReturn:items.length?`${(items.reduce((s,i)=>s+i.changePct,0)/items.length).toFixed(2)}%`:'—'});
const morning = items => [...items].filter(i=>i.scored.totalScore>=8).sort((a,b)=>b.scored.totalScore-a.scored.totalScore).slice(0,2).map(i=>({
  symbol:i.symbol,name:i.name,market:i.market,currentPrice:i.currentDrPrice,entry:i.scored.entry,tp1:i.scored.tp1,tp2:i.scored.tp2,
  sl:i.scored.sl,riskReward:i.scored.riskReward,changePct:i.changePct,status:'Waiting',statusThai:'แผนเฝ้าดูจากแท่งปิด',source:i.source,dataAsOf:i.dataAsOf}));

export async function generateStrategyFeed({loadSeries=loadScanSeries,quotes=symbols=>yf.quote(symbols),now=Date.now(),markets=['thai','dr'],env=process.env}={}) {
  const quoteSymbols=[...new Set(['USDTHB=X','HKDTHB=X',...DR_SPECS.map(s=>s.underlying),])];
  let rawQuotes=[];
  const quoteDisplayAllowed=env.NODE_ENV!=='production'||env.YAHOO_DISPLAY_RIGHTS_CONFIRMED==='true';
  try { if(markets.includes('dr')&&quoteDisplayAllowed)rawQuotes=await quotes(quoteSymbols); } catch { /* Quotes and candles fail independently. */ }
  const quoteMap=new Map((Array.isArray(rawQuotes)?rawQuotes:[]).map(q=>[q.symbol,q]));
  const price=symbol=>{const n=quoteMap.get(symbol)?.regularMarketPrice;return positive(n)?n:null;};
  const liveUsdThb=price('USDTHB=X'),liveHkdThb=price('HKDTHB=X');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const expectedDay=expectedClosedDay(now);
  const unavailable=[];
  async function scan(item,market) {
    const asset=ALL_ASSETS.find(a=>a.id===market&&a.symbol===item.symbol);
    try {
      if(!asset)throw Object.assign(Error(),{code:'UNKNOWN_INSTRUMENT'});
      const series=await loadSeries(asset);
      if(series.symbol!==asset.symbol || series.instrumentId&&series.instrumentId!==asset.instrumentId || series.timeframe!=='1d')throw Object.assign(Error(),{code:'INSTRUMENT_MISMATCH'});
      const bars=(series.bars||[]).filter(b=>typeof b.time==='string'&&b.time<today);
      let prior='';
      for(const b of bars){
        const date=Date.parse(`${b.time}T00:00:00Z`);
        if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==b.time||b.time<=prior||![b.open,b.high,b.low,b.close].every(positive)||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close))throw Object.assign(Error(),{code:'INVALID_CLOSED_BARS'});
        prior=b.time;
      }
      if(bars.length<75)throw Object.assign(Error(),{code:'INSUFFICIENT_CLOSED_BARS'});
      if(!expectedDay)throw Object.assign(Error(),{code:'CALENDAR_NOT_VERIFIED'});
      if(series.freshness==='stale'||bars.at(-1).time!==expectedDay)throw Object.assign(Error(),{code:'STALE_CLOSED_BARS'});
      const last=bars.at(-1),previous=bars.at(-2),changePct=Math.round((last.close/previous.close-1)*10000)/100;
      const scored=scoreDRCandidate({symbol:item.symbol,currentPrice:last.close,changePct,closes:bars.map(b=>b.close),highs:bars.map(b=>b.high),lows:bars.map(b=>b.low),underlying:item.underlying});
      if(!scored)throw Object.assign(Error(),{code:'INSUFFICIENT_CLOSED_BARS'});
      const underlying=price(item.underlying),fxSymbol=item.currency==='HKD'?'HKDTHB=X':'USDTHB=X';
      const bridge=market==='dr'?comparableBridge(item,quoteMap.get(item.underlying),quoteMap.get(fxSymbol),last.close,last.time,now):null;
      return {...item,market:market==='thai'?'SET':'DR80',currentPrice:last.close,currentDrPrice:last.close,changePct,scored,
        source:series.source,dataAsOf:last.time,barCount:bars.length,chartOnly:Boolean(series.chartOnly),freshness:'closed-session',expectedClosedDay:expectedDay,
        underlyingUsd:underlying,conversionRatio:item.ratio,
        bridge,bridgeCode:market==='dr'&&!bridge?'AS_OF_NOT_ALIGNED':null};
    } catch(error) { unavailable.push({market,symbol:item.symbol,code:error.code||'SOURCE_UNAVAILABLE'});return null; }
  }
  // Bounded requests share the provider clients' cache and concurrency controls.
  const rows=[];
  const jobs=[...THAI_SPECS.map(s=>[s,'thai']),...DR_SPECS.map(s=>[s,'dr'])].filter(([,market])=>markets.includes(market));
  for(let i=0;i<jobs.length;i+=4)rows.push(...await Promise.all(jobs.slice(i,i+4).map(([s,m])=>scan(s,m))));
  const scoredThaiStocks=rows.filter(i=>i?.market==='SET'),scoredDRs=rows.filter(i=>i?.market==='DR80');
  const topMorningThai=morning(scoredThaiStocks),topMorningDr=morning(scoredDRs);
  // No verified dividend-event source is connected; do not reuse fixture annual amounts.
  const liveDividendStocks=[];
  const quoteText=items=>items.slice(0,2).map(i=>`${i.symbol}: ${i.currentDrPrice.toFixed(2)} THB · แท่งปิด ${i.dataAsOf}`).join(' · ')||'ยังไม่มีแท่งปิดสำหรับคำนวณ';
  return {status:rows.some(Boolean)?unavailable.length?'partial':'available':'unavailable',isLiveFeed:false,
    feedSource:[...new Set(rows.filter(Boolean).map(i=>i.source))].join(' / ')||'ยังเชื่อมแหล่งข้อมูลไม่ได้',
    quoteStatus:quoteDisplayAllowed?'provider-response':'DISPLAY_RIGHTS_NOT_CONFIRMED',
    timeframe:'1d',updatedAt:new Date(now).toISOString(),liveUsdThb,liveHkdThb,scoredDRs,scoredThaiStocks,unavailable,
    coverage:{thai:{total:THAI_SPECS.length,available:scoredThaiStocks.length},dr:{total:DR_SPECS.length,available:scoredDRs.length}},
    dividendStatus:'unavailable',dividendCode:'VERIFIED_DIVIDEND_SOURCE_REQUIRED',liveDividendStocks,dividendModel:THAI_DIVIDEND_PORTFOLIO_MODEL,
    avgDivYield:liveDividendStocks.length?(liveDividendStocks.reduce((s,i)=>s+i.yieldPct,0)/liveDividendStocks.length).toFixed(1):'—',
    drKpis:summary(scoredDRs),thaiKpis:summary(scoredThaiStocks),drSampleText:quoteText(scoredDRs),thaiSampleText:quoteText(scoredThaiStocks),
    topMorningThai,topMorningDr,allMorningSignals:[...topMorningThai,...topMorningDr],autoTrackedPicks:[]};
}
