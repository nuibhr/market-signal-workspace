import fs from 'node:fs/promises';
import path from 'node:path';
import YahooFinance from 'yahoo-finance2';
import { getYahooUsDailyBars } from '../src/market-data/us-eod.mjs';

// Explicit maintenance job, never launched by a customer page or an API read.
// Resume caches contain market data only; credentials and signed URLs never leave env.
const dir = path.resolve('data/us-universe');
const asOf = process.argv.find(arg => arg.startsWith('--as-of='))?.slice(8) || (await getYahooUsDailyBars('AAPL')).latestDay;
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('DATE_REQUIRED');
const end = new Date(`${asOf}T23:59:59Z`), start = new Date(`${asOf}T00:00:00Z`); start.setUTCMonth(start.getUTCMonth() - 3);
const from = start.toISOString().slice(0, 10);
const now = end.getTime(), silent = () => {};
const yahoo = new YahooFinance({ versionCheck: false, suppressNotices: ['yahooSurvey'], queue: {concurrency: 1},
  logger: {info: silent, warn: silent, error: silent, debug: silent, dir: silent},
  fetch: (url, options) => fetch(url, {...options, signal: AbortSignal.timeout(15000)}) });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
await fs.mkdir(path.join(dir, 'history'), {recursive: true, mode: 0o700});
const save = async (file, value) => {
  const target = path.join(dir, file), temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value), {mode: 0o600}); await fs.rename(temp, target);
};
const read = async file => {try{return JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));}catch{return null;}};
function directory(text, nasdaq) {
  const lines = text.trim().split(/\r?\n/), headers = lines.shift().split('|');
  return lines.map(line => Object.fromEntries(line.split('|').map((value, index) => [headers[index], value])))
    .filter(row => row['Test Issue'] === 'N' && row.ETF === 'N' && (nasdaq || ['N','A','P','Z','V'].includes(row.Exchange)))
    .filter(row => !/\b(warrant|rights|units|preferred|preference|debenture|notes|closed.end|exchange.traded|fund)\b/i.test(row['Security Name']))
    .map(row => ({symbol: (nasdaq ? row.Symbol : row['ACT Symbol']).replace('.', '-'), name: row['Security Name'],
      exchange: nasdaq ? 'NASDAQ' : row.Exchange === 'N' ? 'NYSE' : 'AMEX'}))
    .filter(row => /^[A-Z][A-Z0-9-]{0,11}$/.test(row.symbol));
}
let quotes = await read(`quotes-${asOf}.json`);
if (!quotes) {
  const pool = new Map();
  for (const [file, isNasdaq] of [['nasdaqlisted', true], ['otherlisted', false]]) {
    const response = await fetch(`https://www.nasdaqtrader.com/dynamic/symdir/${file}.txt`, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('DIRECTORY_UNAVAILABLE');
    const text = await response.text();
    if (!text.startsWith(isNasdaq ? 'Symbol|' : 'ACT Symbol|')) throw new Error('INVALID_DIRECTORY');
    for (const row of directory(text, isNasdaq)) pool.set(row.symbol, row);
  }
  quotes = {asOf, directoryCount: pool.size, rows: []};
  const symbols = [...pool.keys()];
  for (let offset = 0; offset < symbols.length; offset += 100) {
    const batch = symbols.slice(offset, offset + 100);
    let response;
    try {response = await yahoo.quote(batch, {}, {validateResult: false});}
    catch {throw new Error('QUOTE_POOL_UNAVAILABLE');}
    for (const row of response) {
      if (!batch.includes(row.symbol) || row.quoteType !== 'EQUITY' || row.currency !== 'USD'
        || !['NMS','NGM','NCM','NYQ','ASE','PCX','BTS'].includes(row.exchange)
        || !Number.isFinite(row.regularMarketPrice) || row.regularMarketPrice <= 0
        || !Number.isFinite(row.averageDailyVolume3Month) || row.averageDailyVolume3Month <= 0) continue;
      quotes.rows.push({...pool.get(row.symbol), name: row.longName || row.shortName || pool.get(row.symbol).name,
        price: row.regularMarketPrice, averageDailyVolume3Month: row.averageDailyVolume3Month,
        preliminaryDollarVolume: row.regularMarketPrice * row.averageDailyVolume3Month});
    }
    if (offset % 500 === 0) console.log(JSON.stringify({phase: 'directory-quotes', processed: Math.min(offset + 100, symbols.length), total: symbols.length}));
    await sleep(1000);
  }
  quotes.rows.sort((a,b) => b.preliminaryDollarVolume - a.preliminaryDollarVolume || a.symbol.localeCompare(b.symbol));
  await save(`quotes-${asOf}.json`, quotes);
}
// A disclosed liquid-stock candidate pool, not a claim to have measured every US listing.
const candidates = quotes.rows.slice(0, 1500), accepted = [], excluded = [];
let fatal = null, nextRequest = 0, cursor = 0;
const deadline=Date.now()+45*60000;
async function worker() {
  while (!fatal && cursor < candidates.length) {
    if(Date.now()>deadline){fatal='COLLECTION_TIMEOUT';break;}
    const item = candidates[cursor++];
    const cached = await read(`history/${item.symbol}-yahoo-${asOf}.json`);
    let series = cached?.asOf === asOf ? cached.series : null;
    if (!series) {
      const scheduled = Math.max(Date.now(), nextRequest); nextRequest = scheduled + 500;
      await sleep(Math.max(0, scheduled - Date.now()));
      if (fatal) break;
      try {series = await getYahooUsDailyBars(item.symbol, {now}); await save(`history/${item.symbol}-yahoo-${asOf}.json`, {asOf, series});}
      catch (error) {
        const code = ['PLAN_REQUIRED','RATE_LIMITED','SOURCE_UNAVAILABLE','INVALID_RESPONSE','BARS_UNAVAILABLE','INVALID_SYMBOL'].includes(error.code) ? error.code : 'SOURCE_UNAVAILABLE';
        excluded.push({symbol: item.symbol, code});
        if (code === 'RATE_LIMITED') fatal = code;
        continue;
      }
    }
    const bars = series.bars.filter(bar => bar.time >= from && bar.time <= asOf);
    const last = bars.at(-1);
    if (series.symbol !== item.symbol || series.bars.length < 60 || bars.length < 50 || !last || last.time !== asOf || !bars.some(bar => bar.volume > 0)) {
      excluded.push({symbol: item.symbol, code: 'INCOMPLETE_OR_STALE_HISTORY'}); continue;
    }
    const averageDollarVolume = bars.reduce((sum, bar) => sum + bar.close * bar.volume, 0) / bars.length;
    if (!Number.isFinite(averageDollarVolume) || averageDollarVolume <= 0) {excluded.push({symbol: item.symbol, code: 'INVALID_LIQUIDITY'}); continue;}
    accepted.push({kind: 'stock', symbol: item.symbol, name: item.name, theme: 'หุ้นสภาพคล่องสูง', exchange: item.exchange,
      averageDollarVolume: Math.round(averageDollarVolume), periodBars: bars.length, latestDay: last.time,
      scannerBars: series.bars.length, scannerSource: 'Yahoo EOD'});
    if ((accepted.length + excluded.length) % 100 === 0) {
      const progress = {phase: 'historical-validation',processed: accepted.length + excluded.length,total: candidates.length,available: accepted.length,excluded: excluded.length};
      await save('progress.json', progress); console.log(JSON.stringify(progress));
    }
  }
}
await Promise.all([worker(), worker()]);
if (fatal) {await save('progress.json', {phase:'blocked',code:fatal,processed:accepted.length+excluded.length,total:candidates.length}); console.error(fatal); process.exitCode=1;}
else {
  accepted.sort((a,b) => b.averageDollarVolume - a.averageDollarVolume || a.symbol.localeCompare(b.symbol));
  const stocks = accepted.slice(0, 500).map((item, index) => ({...item, popularityRank: index + 1}));
  const metadata = {asOf, from, to: asOf, target:500, count:stocks.length, directoryCount:quotes.directoryCount,
    quotedCount:quotes.rows.length, candidateCount:candidates.length, validatedCount:accepted.length, excludedCount:excluded.length,
    criterion:'Mean daily close × volume over the trailing three calendar months',
    shortlist:'Top 1,500 by latest USD price × Yahoo average daily volume (3 months)',
    source:'Nasdaq Trader directory + Yahoo Finance quote + Yahoo Finance closed EOD candles',
    signalTimeframe:'1d', updatedAt:new Date().toISOString()};
  await save('report.json', {metadata, stocks, excluded});
  if (stocks.length < 500) {console.error(JSON.stringify({code:'LESS_THAN_500_VERIFIED',count:stocks.length})); process.exitCode=1;}
  else {
    const target=path.resolve('src/markets/us-liquid-500.mjs');
    const text='// Generated by scripts/build-us-universe.mjs. Verified data coverage is separate from an entry signal.\n'
      +`export const US_UNIVERSE_METADATA = ${JSON.stringify(metadata,null,2)};\n`
      +`export const US_LIQUID_STOCKS = ${JSON.stringify(stocks,null,2)};\n`
      +'export const US_SCAN_SYMBOLS = US_LIQUID_STOCKS.map(item => item.symbol);\n';
    await fs.writeFile(`${target}.tmp`, text); await fs.rename(`${target}.tmp`, target);
    console.log(JSON.stringify({phase:'complete',...metadata,top:stocks.slice(0,5).map(row=>row.symbol)}));
  }
}
