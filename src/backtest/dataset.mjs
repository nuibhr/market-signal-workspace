import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SWING_RESEARCH_SPEC, resolveSwingCosts, thaiResearchCosts } from '../analysis/swing-standard.mjs';
const fault = code => Object.assign(new Error(code), { code });

// TradingView/broker CSV exports; no spreadsheet formulas are executed.
export function parseCandleCsv(text, timeframe, { timeZone } = {}) {
  if (!['1d', '4h', '1h', '15m'].includes(timeframe)) throw fault('INVALID_TIMEFRAME');
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { if (row.some(value => value.trim())) rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) throw fault('INVALID_CSV');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, '').trim().toLowerCase());
  const required = ['time', 'open', 'high', 'low', 'close', 'volume'];
  if (!headers || required.some(key => headers.filter(value => value === key).length !== 1) || rows.length > 250000) throw fault('CSV_OHLCV_HEADERS_REQUIRED');
  const byName = Object.fromEntries(required.map(key => [key, headers.indexOf(key)]));
  let previous = -Infinity, previousDay = '';
  return rows.map(values => {
    const raw = values[byName.time]?.trim();
    let ms;
    if (/^\d{10}$/.test(raw)) ms = Number(raw) * 1000;
    else if (/^\d{13}$/.test(raw)) ms = Number(raw);
    else if (timeframe === '1d' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      ms = Date.parse(`${raw}T00:00:00Z`);
      if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== raw) throw fault('INVALID_CANDLE_TIME');
    } else if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) ms = Date.parse(raw);
    if (!Number.isFinite(ms) || ms <= previous) throw fault('CANDLE_TIMEZONE_ORDER_OR_DUPLICATE');
    previous = ms;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const bar = { time: timeframe === '1d' ? timeZone && !dateOnly
      ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
      : new Date(ms).toISOString().slice(0, 10) : Math.floor(ms / 1000) };
    if (timeframe === '1d' && bar.time === previousDay) throw fault('CANDLE_TIMEZONE_ORDER_OR_DUPLICATE');
    previousDay = bar.time;
    for (const key of required.slice(1)) {
      if (!values[byName[key]]?.trim()) throw fault('INVALID_OHLCV');
      bar[key] = Number(values[byName[key]]);
    }
    if (!['open', 'high', 'low', 'close'].every(key => Number.isFinite(bar[key]) && bar[key] > 0) || !Number.isFinite(bar.volume) || bar.volume < 0 ||
        bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close)) throw fault('INVALID_OHLCV');
    return bar;
  });
}

export function inspectSwingDataset(manifest, frames) {
  const from = manifest.from || SWING_RESEARCH_SPEC.requestedFrom, to = manifest.toExclusive || SWING_RESEARCH_SPEC.requestedToExclusive;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || from >= to) throw fault('INVALID_BACKTEST_RANGE');
  const blocked = [], warnings = [], daily = frames['1d'] || [], fourHour = frames['4h'] || [];
  if (!manifest.symbol || !manifest.instrumentId || !['thai', 'dr', 'us', 'tfex'].includes(manifest.market) || !manifest.provider || !manifest.currency || !manifest.timezone) blocked.push('INSTRUMENT_PROVIDER_CURRENCY_TIMEZONE_REQUIRED');
  if (!['breakout', 'pullback', 'both'].includes(manifest.entryMode)) blocked.push('ENTRY_RULE_REQUIRED');
  if (!['raw-with-actions', 'split-adjusted'].includes(manifest.adjustment)) blocked.push('CORPORATE_ACTION_ADJUSTMENT_REQUIRED');
  if (!Array.isArray(manifest.tradingDays) || !manifest.tradingDays.length) blocked.push('TRADING_CALENDAR_REQUIRED');
  else if (manifest.tradingDays.some((date, i) => !validDate(date) || i > 0 && date <= manifest.tradingDays[i - 1])) blocked.push('INVALID_TRADING_CALENDAR');
  if (!daily.length || !fourHour.length) blocked.push('D1_AND_4H_REQUIRED');
  if (daily.filter(bar => bar.time < from).length < 200) blocked.push('PRE_START_WARMUP_200_DAILY_BARS_REQUIRED');
  const inPeriod = daily.filter(bar => bar.time >= from && bar.time < to);
  const dates = new Set(inPeriod.map(bar => bar.time));
  const localDay = seconds => new Intl.DateTimeFormat('en-CA', { timeZone: manifest.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seconds * 1000));
  if (fourHour.filter(bar => localDay(bar.time) < from).length < 50) blocked.push('PRE_START_WARMUP_50_4H_BARS_REQUIRED');
  const groups = new Map();
  for (const bar of fourHour) { const date = localDay(bar.time); groups.set(date, (groups.get(date) || 0) + 1); }
  const expected = Array.isArray(manifest.tradingDays) ? manifest.tradingDays.filter(date => date >= from && date < to) : [];
  const missingDailyDays = expected.filter(date => !dates.has(date));
  if (inPeriod.some(bar => !expected.includes(bar.time))) blocked.push('DAILY_SESSIONS_OUTSIDE_DECLARED_CALENDAR');
  const missing4hDays = inPeriod.filter(bar => !groups.has(bar.time)).map(bar => bar.time);
  if (missingDailyDays.length) blocked.push('MISSING_DAILY_SESSIONS');
  if (missing4hDays.length) blocked.push('MISSING_4H_SESSIONS');
  if (!expected.length || !manifest.expected4hBarsByDay || expected.some(date => !Number.isSafeInteger(manifest.expected4hBarsByDay[date]) || manifest.expected4hBarsByDay[date] <= 0 || groups.get(date) !== manifest.expected4hBarsByDay[date])) blocked.push('INTRADAY_SESSION_COVERAGE_UNVERIFIED');
  if (!(frames['15m']?.length)) blocked.push('EXECUTION_BARS_REQUIRED_FOR_15M_DELAY');
  const executionGroups = new Map();
  for (const bar of frames['15m'] || []) { const date = localDay(bar.time); executionGroups.set(date, (executionGroups.get(date) || 0) + 1); }
  if (!expected.length || !manifest.expected15mBarsByDay || expected.some(date => !Number.isSafeInteger(manifest.expected15mBarsByDay[date]) || manifest.expected15mBarsByDay[date] <= 0 || executionGroups.get(date) !== manifest.expected15mBarsByDay[date])) blocked.push('EXECUTION_SESSION_COVERAGE_UNVERIFIED');
  for (const [frame, key, code] of [['4h', 'expected4hStartsByDay', 'INTRADAY_TIMESTAMPS_UNVERIFIED'], ['15m', 'expected15mStartsByDay', 'EXECUTION_TIMESTAMPS_UNVERIFIED']]) {
    const actual = new Map();
    for (const bar of frames[frame] || []) { const date = localDay(bar.time); if (!actual.has(date)) actual.set(date, []); actual.get(date).push(bar.time); }
    if (!expected.length || expected.some(date => {
      const starts = manifest[key]?.[date], observed = actual.get(date) || [];
      return !Array.isArray(starts) || !starts.length || starts.length !== observed.length ||
        starts.some((time, i) => !Number.isSafeInteger(time) || time !== observed[i]);
    })) blocked.push(code);
  }
  let costs;
  try { costs = resolveSwingCosts(manifest.costs || (manifest.market === 'thai' ? thaiResearchCosts(manifest.liquidityClass || 'large') : null)); }
  catch { blocked.push('EXACT_COST_COMPONENTS_REQUIRED'); }
  if (manifest.market === 'tfex') blocked.push('TFEX_CONTRACT_COST_DIRECTION_AND_ROLLOVER_REQUIRED');
  if (!Array.isArray(manifest.earningsDates) || !frames.marketIndex?.length) warnings.push('ADVANCED_EARNINGS_AND_MARKET_FILTER_DATA_REQUIRED');
  if (!manifest.dividendEvents?.length) warnings.push('DIVIDENDS_EXCLUDED_WITHOUT_EVENT_DATA');
  if (manifest.adjustment === 'raw-with-actions' && !manifest.corporateActions?.length) blocked.push('RAW_PRICE_CORPORATE_ACTION_EVENTS_REQUIRED');
  warnings.push('DATA_PROVIDER_AND_CALENDAR_DECLARATIONS_REQUIRE_REVIEW', 'CURRENT_UNIVERSE_IS_NOT_POINT_IN_TIME_UNIVERSE');
  return { status: blocked.length ? 'blocked' : 'data-preflight-passed', strategyValidated: false,
    requestedFrom: from, requestedToExclusive: to, symbol: manifest.symbol, market: manifest.market,
    counts: { daily: daily.length, dailyInPeriod: inPeriod.length, fourHour: fourHour.length, execution: frames['15m']?.length || 0 },
    missingDailyDays, missing4hDays, costs, blocked: [...new Set(blocked)], warnings };
}

export function loadSwingManifest(path) {
  const real = realpathSync(path), root = dirname(real);
  if (statSync(real).size > 1000000 || extname(real) !== '.json') throw fault('INVALID_MANIFEST');
  const manifest = JSON.parse(readFileSync(real, 'utf8')), frames = {}, hashes = {};
  for (const [frame, file] of Object.entries(manifest.files || {})) {
    if (!['1d', '4h', '15m'].includes(frame) || typeof file !== 'string') throw fault('INVALID_DATASET_FILE');
    const target = realpathSync(resolve(root, file)), within = relative(root, target), info = statSync(target);
    if (within.startsWith('..') || isAbsolute(within) || !info.isFile() || info.size > 30000000) throw fault('DATASET_FILE_OUTSIDE_ROOT_OR_TOO_LARGE');
    if (extname(target).toLowerCase() === '.parquet') throw fault('PARQUET_TO_CSV_REQUIRED');
    if (extname(target).toLowerCase() !== '.csv') throw fault('CSV_REQUIRED');
    const bytes = readFileSync(target); hashes[frame] = createHash('sha256').update(bytes).digest('hex');
    frames[frame] = parseCandleCsv(bytes.toString('utf8'), frame, { timeZone: manifest.timezone });
  }
  return { manifest, frames, report: { ...inspectSwingDataset(manifest, frames), datasetHashes: hashes } };
}

export const inspectSwingManifest = path => loadSwingManifest(path).report;
