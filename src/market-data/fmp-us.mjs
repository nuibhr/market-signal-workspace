import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cloudCacheGet, cloudCachePut, cloudStorage } from './cloud-cache.mjs';
const BASE = 'https://financialmodelingprep.com/stable/historical-price-eod/full';
const cache = new Map();
const pending = new Map();
const TTL_MS = 90_000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
let nextRequestAt = 0;
function validStored(series, symbol, marketDay, allowCurrentDay) {
  return series?.symbol === symbol && series.timeframe === '1d' && series.source === 'Financial Modeling Prep · EOD'
    && Array.isArray(series.bars) && series.bars.length > 0 && series.bars.length <= 300
    && series.latestDay === series.bars.at(-1)?.time && series.bars.every((bar, index, bars) =>
      typeof bar.time === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bar.time)
      && bar.time <= marketDay && (allowCurrentDay || bar.time !== marketDay)
      && (!index || bar.time > bars[index - 1].time)
      && [bar.open, bar.high, bar.low, bar.close, bar.volume].every(finite)
      && Math.min(bar.open,bar.high,bar.low,bar.close) > 0 && bar.volume >= 0
      && bar.high >= Math.max(bar.open,bar.close,bar.low) && bar.low <= Math.min(bar.open,bar.close));
}

export function newYorkParts(value = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
    weekday: values.weekday,
  };
}

/** Keep the previous close eligible for a short catch-up window if EOD data arrives late. */
export function usEodSession(now = Date.now()) {
  const clock = newYorkParts(now);
  const businessDay = !['Sat', 'Sun'].includes(clock.weekday);
  const afterClose = businessDay && clock.minutes >= 16 * 60 + 30;
  const catchUp = clock.weekday !== 'Sun' && clock.minutes < 8 * 60;
  let previousDay = new Date(Date.parse(`${clock.day}T12:00:00Z`) - 86_400_000);
  while ([0, 6].includes(previousDay.getUTCDay())) previousDay = new Date(previousDay.getTime() - 86_400_000);
  return { day: catchUp ? previousDay.toISOString().slice(0, 10) : clock.day,
    scanWindow: afterClose || catchUp, afterDeadline: catchUp || clock.minutes >= 22 * 60 };
}

function includeCurrentDayClose(parts) {
  return !['Sat', 'Sun'].includes(parts.weekday) && parts.minutes >= 16 * 60 + 30;
}

function dateDaysBefore(day, count) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - count * 86_400_000).toISOString().slice(0, 10);
}

export async function getFmpDailyBars(symbol, options = {}) {
  if (options.fetcher && options.fetcher !== fetch) return loadFmpDailyBars(symbol, options);
  const now = options.now ?? Date.now();
  const parts = newYorkParts(now);
  const scope = createHash('sha256').update(options.apiKey ?? process.env.FMP_API_KEY ?? '').digest('hex');
  const id = `${scope}:${symbol}:${parts.day}:${includeCurrentDayClose(parts)}`;
  if (!pending.has(id)) pending.set(id, loadFmpDailyBars(symbol, options).finally(() => pending.delete(id)));
  return pending.get(id);
}
async function loadFmpDailyBars(symbol, { now = Date.now(), apiKey = process.env.FMP_API_KEY, fetcher = fetch } = {}) {
  if (!apiKey?.trim()) { const error = new Error('SOURCE_NOT_CONFIGURED'); error.code = error.message; throw error; }
  if (typeof symbol !== 'string' || !/^[A-Z0-9-]{1,12}$/.test(symbol)) {
    const error = new Error('INVALID_SYMBOL'); error.code = error.message; throw error;
  }
  const marketParts = newYorkParts(now);
  const marketDay = marketParts.day;
  const allowCurrentDay = includeCurrentDayClose(marketParts);
  const cacheKey = `${createHash('sha256').update(apiKey).digest('hex')}:${symbol}:${marketDay}:${allowCurrentDay ? 'closed' : 'intraday'}`;
  const hit = cache.get(cacheKey);
  if (fetcher === fetch && hit?.expiresAt > Date.now()) return hit.data;
  if(fetcher===fetch){const cloudHit=await cloudCacheGet(cacheKey);if(validStored(cloudHit,symbol,marketDay,allowCurrentDay))return cloudHit;}
  const storedPath = resolve(process.cwd(), 'data', 'us-eod', createHash('sha256').update(cacheKey).digest('hex') + '.json');
  if (fetcher === fetch) {
    try {
      if (!cloudStorage() && (await stat(storedPath)).size < 100_000) {
        const stored = JSON.parse(await readFile(storedPath, 'utf8'));
        if (stored.cacheKey === cacheKey && stored.expiresAt > Date.now() && validStored(stored.data, symbol, marketDay, allowCurrentDay)) {
          cache.set(cacheKey, {data:stored.data, expiresAt:Date.now()+TTL_MS}); return stored.data;
        }
      }
    } catch { /* A missing or invalid cache never substitutes for provider data. */ }
    const scheduledAt = Math.max(Date.now(), nextRequestAt); nextRequestAt = scheduledAt + 500;
    if (scheduledAt > Date.now()) await new Promise(resolve => setTimeout(resolve, scheduledAt - Date.now()));
  }

  const url = new URL(BASE);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('from', dateDaysBefore(marketDay, 450));
  url.searchParams.set('to', marketDay);
  url.searchParams.set('apikey', apiKey.trim());
  let response;
  try { response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) }); }
  catch { const error = new Error('SOURCE_UNAVAILABLE'); error.code = error.message; throw error; }
  if (!response.ok) {
    const error = new Error(response.status === 402 ? 'PLAN_REQUIRED' : response.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE');
    error.code = error.message;
    throw error;
  }
  let payload;
  try { payload = await response.json(); }
  catch { const error = new Error('INVALID_RESPONSE'); error.code = error.message; throw error; }
  if (!Array.isArray(payload)) { const error = new Error('INVALID_RESPONSE'); error.code = error.message; throw error; }

  const byDay = new Map();
  const duplicateDays = new Set();
  for (const row of payload) {
    if (row?.symbol !== symbol || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
      || row.date > marketDay || (!allowCurrentDay && row.date === marketDay)
      || ![row.open, row.high, row.low, row.close, row.volume].every(finite)
      || row.open <= 0 || row.close <= 0 || row.low <= 0 || row.volume < 0
      || row.high < Math.max(row.open, row.close, row.low) || row.low > Math.min(row.open, row.close)) continue;
    if (byDay.has(row.date)) { byDay.delete(row.date); duplicateDays.add(row.date); continue; }
    if (duplicateDays.has(row.date)) continue;
    byDay.set(row.date, { time: row.date, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume });
  }
  const bars = [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time)).slice(-300);
  if (!bars.length) { const error = new Error('BARS_UNAVAILABLE'); error.code = error.message; throw error; }
  const data = { symbol, source: 'Financial Modeling Prep · EOD', timeframe: '1d',
    receivedAt: new Date().toISOString(), latestDay: bars.at(-1).time, bars };
  if (fetcher === fetch) {
    cache.set(cacheKey, { data, expiresAt: Date.now() + TTL_MS });
    await cloudCachePut(cacheKey,data,allowCurrentDay?6*3600000:300000);
    try {
      if(!cloudStorage()){await mkdir(resolve(process.cwd(),'data','us-eod'), {recursive:true,mode:0o700});
      const temporary = `${storedPath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({cacheKey,data,expiresAt:Date.now()+(allowCurrentDay?6*3600000:300000)}), {mode:0o600});
      await rename(temporary,storedPath);
      }
    } catch { /* Provider data remains available when cache storage is read-only. */ }
  }
  if (cache.size > 750) cache.delete(cache.keys().next().value);
  return data;
}
