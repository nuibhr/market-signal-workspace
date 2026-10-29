import { storage } from '../storage/database.mjs';
import { newYorkParts } from './fmp-us.mjs';

const seconds = { '15m': 900, '1h': 3600, '4h': 14400 };
const day = (ms, market) => new Intl.DateTimeFormat('en-CA', { timeZone: market === 'us' ? 'America/New_York' : 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const cacheId = (asset, timeframe) => `chart-snapshot-v1:${asset.id}:${asset.instrumentId}:${timeframe}`;
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function candleClosedAt(bar, timeframe, market) {
  if (timeframe !== '1d') return seconds[timeframe] && Number.isSafeInteger(bar.time) && bar.time > 0 ? (bar.time + seconds[timeframe]) * 1000 : NaN;
  if (typeof bar.time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(bar.time)) return NaN;
  const date = Date.parse(`${bar.time}T00:00:00Z`);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== bar.time) return NaN;
  if (market === 'forex') return date + 86400000;
  if (market !== 'us') return Date.parse(`${bar.time}T17:00:00+07:00`);
  const summerClose = Date.parse(`${bar.time}T20:00:00Z`);
  return newYorkParts(summerClose).minutes === 960 ? summerClose : summerClose + 3600000;
}

// A minimum availability lag, not a claim that the vendor's feed has an exact SLA.
// No current quote survives a fallback, and it cannot authorize a live entry.
export function delayedChartSeries(series, asset, timeframe, now = Date.now(), kind = 'snapshot') {
  if (!series || series.instrumentId !== asset.instrumentId || series.timeframe !== timeframe || !Array.isArray(series.bars) || !series.bars.length || series.bars.length > 5000) return null;
  let previous = -Infinity;
  for (const bar of series.bars) {
    const end = candleClosedAt(bar, timeframe, asset.id);
    if (!Number.isFinite(end) || end <= previous || ![bar.open, bar.high, bar.low, bar.close].every(positive) ||
        !Number.isFinite(bar.volume) || bar.volume < 0 || bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close)) return null;
    previous = end;
  }
  const availableThrough = now - 15 * 60000;
  const bars = series.bars.filter(bar => candleClosedAt(bar, timeframe, asset.id) <= availableThrough);
  if (!bars.length) return null;
  const last = bars.at(-1), closedAt = candleClosedAt(last, timeframe, asset.id);
  const lagSeconds = (now - closedAt) / 1000;
  const staleAfter = timeframe === '1d' ? 5 * 86400 : Math.max(1800, seconds[timeframe] * 2) + 900;
  return { ...series, bars, status: 'available', availableBars: bars.length, quote: null,
    signalEligible: false, executionEligible: false, chartOnly: true,
    fallback: true, fallbackKind: kind, minimumDelayMinutes: 15,
    availableThrough: new Date(availableThrough).toISOString(), dataAsOf: new Date(closedAt).toISOString(),
    availabilityBasis: timeframe === '1d' ? 'conservative-daily-close-boundary' : 'intraday-timeframe-end', providerDelaySeconds: null,
    observedDelaySeconds: lagSeconds, freshness: lagSeconds > staleAfter ? 'stale' : 'delayed',
    latestDay: timeframe === '1d' ? last.time : day(last.time * 1000, asset.id),
    latestTime: timeframe === '1d' ? null : new Date(last.time * 1000).toISOString(),
    source: kind === 'yahoo' ? 'Yahoo Finance · Delayed fallback' : `${series.source} · Delayed snapshot`,
    note: 'ข้อมูลสำรอง ใช้แท่งปิดที่เก่าอย่างน้อย 15 นาที แสดงเวลาแท่งจริง ไม่ใช่ราคาสดและไม่ยืนยันจุดเข้าย้อนหลัง' };
}

export async function rememberChartSnapshot(series, asset, timeframe, now = Date.now()) {
  // Validate the complete native series before retaining anything. Store only
  // public candles, never a quote, credential, member or plan.
  if (!series?.bars?.length || series.chartOnly) return;
  const checked = delayedChartSeries(series, asset, timeframe, now + 15 * 60000);
  if (!checked) return;
  const snapshot = { instrumentId: asset.instrumentId, symbol: asset.symbol, timeframe, market: asset.id,
    source: series.source, receivedAt: series.receivedAt, bars: checked.bars };
  const wrapper = { dataAsOfMs: candleClosedAt(checked.bars.at(-1), timeframe, asset.id), series: snapshot };
  try {
    await storage.run(`INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at
      WHERE json_extract(excluded.payload_json,'$.dataAsOfMs') >= json_extract(provider_cache.payload_json,'$.dataAsOfMs')`,
      cacheId(asset, timeframe), JSON.stringify(wrapper), now + 7 * 86400000);
  } catch { /* A chart response must not fail because its optional cache is down. */ }
}

export async function delayedChartSnapshot(asset, timeframe, now = Date.now()) {
  try {
    const row = await storage.first('SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?', cacheId(asset, timeframe), now);
    return row ? delayedChartSeries(JSON.parse(row.payload_json).series, asset, timeframe, now) : null;
  } catch { return null; }
}
