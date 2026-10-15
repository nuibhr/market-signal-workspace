import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import YahooFinance from 'yahoo-finance2';
import { ALL_ASSETS } from '../src/markets/catalog.mjs';
import { createSettradeClient, createTfexClient } from '../src/market-data/settrade.mjs';
import { getUsDailyBars } from '../src/market-data/us-eod.mjs';
import { getYahooHistory } from '../src/market-data/yahoo-history.mjs';
import { candleClosedAt } from '../src/market-data/delayed-candles.mjs';
import { SWING_RESEARCH_SPEC, thaiResearchCosts, drResearchCosts, TFEX_USER_COMMISSIONS } from '../src/analysis/swing-standard.mjs';
import { TFEX_PRODUCTS } from '../src/markets/tfex-contracts.mjs';

const destination = process.argv[2];
if (!destination) throw Error('Usage: node --env-file=.env.local scripts/export-swing-csv.mjs /absolute/output-directory');
const directory = resolve(destination), now = Date.now();
if (existsSync(directory) && readdirSync(directory).length) throw Error('EXPORT_DIRECTORY_MUST_BE_EMPTY');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const native = { thai: createSettradeClient(), dr: createSettradeClient(), tfex: createTfexClient() };
const silent = () => {};
const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'], versionCheck: false, queue: { concurrency: 1 },
  logger: { info: silent, warn: silent, error: silent, debug: silent, dir: silent },
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) });
const instruments = [['thai', 'SCB'], ['thai', 'PTT'], ['dr', 'AAPL80'], ['tfex', 'S50Z26'], ['tfex', 'GOZ26'], ['us', 'NVDA'], ['us', 'SPY']];
const reports = [];
async function nativeSeries(market, symbol, timeframe) {
  try { return await native[market].getCandles(symbol, timeframe, 1000); }
  catch (error) {
    if (error.status && error.status < 500 || !/(UNAVAILABLE|TIMEOUT|NETWORK)/.test(error.code || '')) throw error;
    await new Promise(resolve => setTimeout(resolve, 1500));
    return native[market].getCandles(symbol, timeframe, 1000);
  }
}
const row = cells => cells.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',');
for (const [market, symbol] of instruments) {
  const asset = ALL_ASSETS.find(value => value.id === market && value.symbol === symbol);
  if (!asset) { reports.push({ market, symbol, code: 'INSTRUMENT_NOT_IN_CURRENT_CATALOG' }); continue; }
  const folder = join(directory, `${market}-${symbol}`); mkdirSync(folder, { recursive: true, mode: 0o700 });
  const contract = market === 'tfex' ? TFEX_PRODUCTS.find(product => symbol.startsWith(product.root)) : null;
  const manifest = { symbol, market, instrumentId: asset.instrumentId, currency: contract?.quoteCurrency || (market === 'us' ? 'USD' : 'THB'),
    ...(contract ? { settlementCurrency: 'THB', contractMultiplier: contract.multiplier, tickSize: contract.tickSize,
      contractCommission: TFEX_USER_COMMISSIONS[contract.root] || null } : {}),
    timezone: market === 'us' ? 'America/New_York' : 'Asia/Bangkok', provider: 'see-provenance.json',
    from: SWING_RESEARCH_SPEC.requestedFrom, toExclusive: SWING_RESEARCH_SPEC.requestedToExclusive,
    entryMode: 'both', adjustment: null, liquidityClass: 'large', costs: market === 'thai' ? thaiResearchCosts() : market === 'dr' ? drResearchCosts() : null,
    ...(market === 'dr' ? { costVariants: [drResearchCosts('lower'), drResearchCosts('stress')] } : {}),
    commissionScope: ['thai', 'dr'].includes(market) ? 'user-confirmed-0.06-percent-per-side-excludes-VAT' : 'US user-defined / TFEX fixed per-contract model required',
    files: {}, tradingDays: [], expected4hBarsByDay: {}, expected15mBarsByDay: {}, expected4hStartsByDay: {}, expected15mStartsByDay: {},
    note: 'Actual observations, incomplete research dataset. No missing candles have been generated. Price adjustment and session coverage require review.' };
  const provenance = [];
  const frames = market === 'us' ? ['1d', '1h', '15m'] : ['1d', '4h', '15m'];
  for (const timeframe of frames) {
    try {
      let series;
      if (market === 'us') {
        // Export deeper native-identity Yahoo D1 history plus warmup. Intraday
        // remains bounded by provider history; it is never expanded to three years.
        series = await getYahooHistory(asset, timeframe, { chartFetcher: (ticker, options) => yahoo.chart(ticker, {
          ...options, ...(timeframe === '1d' ? { period1: new Date(now - 1600 * 86400000) } : {}),
        }) });
      } else series = await nativeSeries(market, symbol, timeframe);
      const bars = series.bars.filter(bar => candleClosedAt(bar, timeframe, market) <= now - 15 * 60000);
      if (!bars.length) throw Object.assign(Error(), { code: 'NO_COMPLETE_BARS' });
      const csv = ['time,open,high,low,close,volume', ...bars.map(bar => [typeof bar.time === 'string' ? bar.time : new Date(bar.time * 1000).toISOString(), bar.open, bar.high, bar.low, bar.close, bar.volume].join(','))].join('\n') + '\n';
      const filename = `${symbol}-${timeframe}.csv`; writeFileSync(join(folder, filename), csv, { mode: 0o600 });
      if (['1d', '4h', '15m'].includes(timeframe)) manifest.files[timeframe] = filename;
      const item = { market, symbol, instrumentId: asset.instrumentId, timeframe, source: series.source,
        sourceTicker: series.sourceTicker || symbol, bars: bars.length, first: bars[0].time, last: bars.at(-1).time,
        exportedAt: new Date(now).toISOString(), minimumAvailabilityLagMinutes: 15, priceAdjustment: 'unverified',
        sha256: createHash('sha256').update(csv).digest('hex'), filename };
      provenance.push(item); reports.push(item);
      console.log(JSON.stringify({ market, symbol, timeframe, bars: bars.length, first: item.first, last: item.last }));
    } catch (error) {
      const item = { market, symbol, timeframe, code: ['INSTRUMENT_NOT_SUPPORTED', 'TIMEFRAME_NOT_AVAILABLE', 'HISTORY_UNAVAILABLE', 'INSTRUMENT_MISMATCH', 'BARS_UNAVAILABLE', 'NO_COMPLETE_BARS'].includes(error.code) ? error.code : 'SOURCE_UNAVAILABLE' };
      provenance.push(item); reports.push(item); console.log(JSON.stringify(item));
      // Native US EOD remains a separately labelled fallback; never silently
      // combine FMP and Yahoo price adjustment regimes inside one CSV.
      if (market === 'us' && timeframe === '1d') {
        try {
          const series = await getUsDailyBars(symbol, { assetKind: asset.sectionId === 'US_ETFS' ? 'etf' : 'stock' });
          const csv = ['time,open,high,low,close,volume', ...series.bars.map(bar => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume].join(','))].join('\n') + '\n';
          const filename = `${symbol}-1d-native.csv`; writeFileSync(join(folder, filename), csv, { mode: 0o600 }); manifest.files['1d'] = filename;
          const fallback = { market, symbol, timeframe, source: series.source, bars: series.bars.length, first: series.bars[0].time, last: series.bars.at(-1).time, filename,
            sha256: createHash('sha256').update(csv).digest('hex'), priceAdjustment: 'unverified' };
          provenance.push(fallback); reports.push(fallback);
        } catch { /* The source failure remains explicit in the export inventory. */ }
      }
    }
  }
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(join(folder, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', { mode: 0o600 });
}
writeFileSync(join(directory, 'inventory.json'), JSON.stringify({ exportedAt: new Date(now).toISOString(), requestedFrom: SWING_RESEARCH_SPEC.requestedFrom,
  requestedToExclusive: SWING_RESEARCH_SPEC.requestedToExclusive, completeThreeYearBacktestData: false,
  note: 'Native contracts and tickers only. US 1H is not relabelled as 4H. MGO is not substituted with GO or spot gold. No simulated candle values.', files: reports }, null, 2) + '\n', { mode: 0o600 });
const fields = ['market', 'symbol', 'timeframe', 'source', 'bars', 'first', 'last', 'filename', 'code', 'sha256'];
writeFileSync(join(directory, 'inventory.csv'), [row(fields), ...reports.map(item => row(fields.map(key => item[key])))].join('\n') + '\n', { mode: 0o600 });
