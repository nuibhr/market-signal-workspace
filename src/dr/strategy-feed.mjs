import YahooFinance from 'yahoo-finance2';
import { loadChartBackup } from '../market-data/chart-backup.mjs';
import { createSettradeClient } from '../market-data/settrade.mjs';
import { ALL_ASSETS } from '../markets/catalog.mjs';
import { calcIndicativePrice, scoreDRCandidate, TOP_THAI_DIVIDEND_STOCKS, THAI_DIVIDEND_PORTFOLIO_MODEL } from './strategy-tracker.mjs';

const yf = new YahooFinance({suppressNotices:['yahooSurvey'],versionCheck:false,
  fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),queue:{concurrency:4}});
const native = createSettradeClient();
export async function loadScanSeries(asset, { env=process.env, client=native, backup=loadChartBackup }={}) {
  if (client.configuration.configured && (env.NODE_ENV!=='production'||env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED==='true')) {
    try {
      const series=await client.getCandles(asset.symbol,'1d',750);
      if(series.symbol!==asset.symbol||![`SET:${asset.symbol}`,asset.instrumentId].includes(series.instrumentId))throw Error('INSTRUMENT_MISMATCH');
      return {...series,instrumentId:asset.instrumentId};
    } catch { /* Use labelled closed historical bars if the native feed fails. */ }
  }
  return backup(asset,'1d');
}

const DR_SPECS = [
  { symbol: 'AAPL80', name: 'Apple Inc. DR', underlying: 'AAPL', ratio: 1000 },
  { symbol: 'NVDA80', name: 'NVIDIA Corp. DR', underlying: 'NVDA', ratio: 160 },
  { symbol: 'MSFT80', name: 'Microsoft Corp. DR', underlying: 'MSFT', ratio: 1500 },
  { symbol: 'TSLA80', name: 'Tesla Inc. DR', underlying: 'TSLA', ratio: 3000 },
  { symbol: 'BABA80', name: 'Alibaba Group DR', underlying: 'BABA', ratio: 800 },
  { symbol: 'TENCENT80', name: 'Tencent Holdings DR', underlying: '0700.HK', ratio: 100, hkd: true },
];

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

export async function generateStrategyFeed({loadSeries=loadScanSeries,quotes=symbols=>yf.quote(symbols),now=Date.now()}={}) {
  const quoteSymbols=[...new Set(['USDTHB=X','HKDTHB=X',...DR_SPECS.map(s=>s.underlying),...TOP_THAI_DIVIDEND_STOCKS.map(s=>`${s.symbol}.BK`)])];
  let rawQuotes=[];
  try { rawQuotes=await quotes(quoteSymbols); } catch { /* Quotes and candles fail independently. */ }
  const quoteMap=new Map((Array.isArray(rawQuotes)?rawQuotes:[]).map(q=>[q.symbol,q]));
  const price=symbol=>{const n=quoteMap.get(symbol)?.regularMarketPrice;return positive(n)?n:null;};
  const liveUsdThb=price('USDTHB=X'),liveHkdThb=price('HKDTHB=X');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const unavailable=[];
  async function scan(item,market) {
    const asset=ALL_ASSETS.find(a=>a.id===market&&a.symbol===item.symbol);
    try {
      if(!asset)throw Object.assign(Error(),{code:'UNKNOWN_INSTRUMENT'});
      const series=await loadSeries(asset);
      if(series.symbol!==asset.symbol || series.instrumentId&&series.instrumentId!==asset.instrumentId || series.timeframe!=='1d')throw Object.assign(Error(),{code:'INSTRUMENT_MISMATCH'});
      const bars=(series.bars||[]).filter(b=>typeof b.time==='string'&&b.time<today&&[b.open,b.high,b.low,b.close].every(positive));
      if(bars.length<75)throw Object.assign(Error(),{code:'INSUFFICIENT_CLOSED_BARS'});
      const last=bars.at(-1),previous=bars.at(-2),changePct=Math.round((last.close/previous.close-1)*10000)/100;
      const scored=scoreDRCandidate({symbol:item.symbol,currentPrice:last.close,changePct,closes:bars.map(b=>b.close),highs:bars.map(b=>b.high),lows:bars.map(b=>b.low),underlying:item.underlying});
      if(!scored)throw Object.assign(Error(),{code:'INSUFFICIENT_CLOSED_BARS'});
      const underlying=price(item.underlying),fx=item.hkd?liveHkdThb:liveUsdThb;
      return {...item,market:market==='thai'?'SET':'DR80',currentPrice:last.close,currentDrPrice:last.close,changePct,scored,
        source:series.source,dataAsOf:last.time,barCount:bars.length,chartOnly:Boolean(series.chartOnly),
        underlyingUsd:underlying,conversionRatio:item.ratio,
        bridge:market==='dr'&&underlying&&fx?calcIndicativePrice({underlyingUsd:underlying,usdThbRate:fx,conversionRatio:item.ratio,currentDrPrice:last.close}):null};
    } catch(error) { unavailable.push({market,symbol:item.symbol,code:error.code||'SOURCE_UNAVAILABLE'});return null; }
  }
  // Bounded requests share the provider clients' cache and concurrency controls.
  const rows=[];
  const jobs=[...THAI_SPECS.map(s=>[s,'thai']),...DR_SPECS.map(s=>[s,'dr'])];
  for(let i=0;i<jobs.length;i+=4)rows.push(...await Promise.all(jobs.slice(i,i+4).map(([s,m])=>scan(s,m))));
  const scoredThaiStocks=rows.filter(i=>i?.market==='SET'),scoredDRs=rows.filter(i=>i?.market==='DR80');
  const topMorningThai=morning(scoredThaiStocks),topMorningDr=morning(scoredDRs);
  const liveDividendStocks=TOP_THAI_DIVIDEND_STOCKS.flatMap(stock=>{
    const value=price(`${stock.symbol}.BK`);if(!value)return [];
    return [{...stock,price:value,yieldPct:Math.round(stock.annualDividend/value*10000)/100,
      liveChangePct:quoteMap.get(`${stock.symbol}.BK`)?.regularMarketChangePercent??0}];
  });
  const quoteText=items=>items.slice(0,2).map(i=>`${i.symbol}: ${i.currentDrPrice.toFixed(2)} THB · แท่งปิด ${i.dataAsOf}`).join(' · ')||'ยังไม่มีแท่งปิดสำหรับคำนวณ';
  return {status:rows.some(Boolean)?unavailable.length?'partial':'available':'unavailable',isLiveFeed:false,
    feedSource:[...new Set(rows.filter(Boolean).map(i=>i.source))].join(' / ')||'ยังเชื่อมแหล่งข้อมูลไม่ได้',
    timeframe:'1d',updatedAt:new Date(now).toISOString(),liveUsdThb,liveHkdThb,scoredDRs,scoredThaiStocks,unavailable,
    coverage:{thai:{total:THAI_SPECS.length,available:scoredThaiStocks.length},dr:{total:DR_SPECS.length,available:scoredDRs.length}},
    liveDividendStocks,dividendModel:THAI_DIVIDEND_PORTFOLIO_MODEL,
    avgDivYield:liveDividendStocks.length?(liveDividendStocks.reduce((s,i)=>s+i.yieldPct,0)/liveDividendStocks.length).toFixed(1):'—',
    drKpis:summary(scoredDRs),thaiKpis:summary(scoredThaiStocks),drSampleText:quoteText(scoredDRs),thaiSampleText:quoteText(scoredThaiStocks),
    topMorningThai,topMorningDr,allMorningSignals:[...topMorningThai,...topMorningDr],autoTrackedPicks:[]};
}
