import { THAI_ALL_SYMBOLS } from '../markets/catalog.mjs';
import { operation as op } from '../storage/database.mjs';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_KNOWN_SET = new Set(THAI_ALL_SYMBOLS);

/**
 * Validate an OHLCV daily bar (pure JS, safe in both Node and Workers).
 */
export function isValidEodBar(bar) {
  if (!bar || !ISO_DAY_RE.test(String(bar.time ?? ''))) return false;
  const parsed = Date.parse(bar.time);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== bar.time) return false;
  const { open, high, low, close, volume } = bar;
  if (![open, high, low, close].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return false;
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0) return false;
  if (high < Math.max(open, close, low) || low > Math.min(open, close)) return false;
  return true;
}

/**
 * Parse SET/Metabase CSV (`D_TRADE,N_SECURITY,Z_OPEN,Z_HIGH,Z_LOW,Z_CLOSE,Q_VOLUME`)
 * or generic CSV (`time,symbol,open,high,low,close,volume`) into normalized records.
 */
export function parseEodCsvRows(csvText, { fallbackSymbol = null } = {}) {
  const lines = String(csvText ?? '').split(/\r?\n/);
  let col = null;
  let totalInputRows = 0;
  let skippedInvalidRows = 0;
  const records = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(',');
    if (!col) {
      const headers = parts.map(h => h.replace(/^\uFEFF/, '').trim().toUpperCase());
      const findCol = (...names) => names.map(n => headers.indexOf(n)).find(idx => idx >= 0) ?? -1;
      const timeIdx = findCol('D_TRADE', 'TIME', 'DATE');
      const symIdx = findCol('N_SECURITY', 'SYMBOL', 'TICKER');
      const openIdx = findCol('Z_OPEN', 'OPEN');
      const highIdx = findCol('Z_HIGH', 'HIGH');
      const lowIdx = findCol('Z_LOW', 'LOW');
      const closeIdx = findCol('Z_CLOSE', 'CLOSE');
      const volIdx = findCol('Q_VOLUME', 'VOLUME', 'VOL');
      if ([timeIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx].some(idx => idx < 0) || (symIdx < 0 && !fallbackSymbol)) {
        throw new Error('UNRECOGNIZED_EOD_CSV_HEADER');
      }
      col = { timeIdx, symIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx };
      continue;
    }

    totalInputRows++;
    const time = parts[col.timeIdx]?.trim();
    const symbol = (col.symIdx >= 0 ? parts[col.symIdx] : fallbackSymbol)?.trim().toUpperCase();
    const bar = {
      time,
      open: Number(parts[col.openIdx]),
      high: Number(parts[col.highIdx]),
      low: Number(parts[col.lowIdx]),
      close: Number(parts[col.closeIdx]),
      volume: Number(parts[col.volIdx]),
    };

    if (!symbol || !isValidEodBar(bar)) {
      skippedInvalidRows++;
      continue;
    }
    records.push({ symbol, bar });
  }

  if (!col) throw new Error('EMPTY_EOD_CSV');
  return { totalInputRows, skippedInvalidRows, records };
}

/**
 * Normalize structured JSON rows (`{ symbol, time, open, high, low, close, volume }`).
 */
export function parseEodJsonRows(rawRows) {
  if (!Array.isArray(rawRows)) throw new Error('ROWS_ARRAY_REQUIRED');
  let skippedInvalidRows = 0;
  const records = [];
  for (const item of rawRows) {
    const symbol = String(item?.symbol ?? item?.N_SECURITY ?? '').trim().toUpperCase();
    const bar = {
      time: String(item?.time ?? item?.D_TRADE ?? '').trim(),
      open: Number(item?.open ?? item?.Z_OPEN),
      high: Number(item?.high ?? item?.Z_HIGH),
      low: Number(item?.low ?? item?.Z_LOW),
      close: Number(item?.close ?? item?.Z_CLOSE),
      volume: Number(item?.volume ?? item?.Q_VOLUME),
    };
    if (!symbol || !isValidEodBar(bar)) {
      skippedInvalidRows++;
      continue;
    }
    records.push({ symbol, bar });
  }
  return { totalInputRows: rawRows.length, skippedInvalidRows, records };
}

/**
 * Upsert only changed/new daily candles into `scanner_candles` (`timeframe = '1d'`).
 */
export async function syncEodCandlesDelta(payload, {
  storage,
  knownSymbols = DEFAULT_KNOWN_SET,
  onlyKnown = true,
  source = 'SET Metabase EOD',
  maxDaysBack = null,
} = {}) {
  const parsed = typeof payload?.csvText === 'string'
    ? parseEodCsvRows(payload.csvText, { fallbackSymbol: payload.symbol ?? null })
    : parseEodJsonRows(payload?.rows ?? []);

  const deduped = new Map();
  let skippedUnknownSymbols = 0;
  let maxDayObserved = '0000-00-00';

  for (const { symbol, bar } of parsed.records) {
    if (onlyKnown && !knownSymbols.has(symbol)) {
      skippedUnknownSymbols++;
      continue;
    }
    if (bar.time > maxDayObserved) maxDayObserved = bar.time;
    deduped.set(`${symbol}|${bar.time}`, { symbol, bar });
  }

  let cutoffDay = null;
  if (Number.isFinite(maxDaysBack) && maxDaysBack > 0 && maxDayObserved !== '0000-00-00') {
    cutoffDay = new Date(Date.parse(`${maxDayObserved}T00:00:00Z`) - maxDaysBack * 86_400_000).toISOString().slice(0, 10);
  }

  const candidates = [];
  let minDayWritten = '9999-99-99';
  let maxDayWritten = '0000-00-00';
  const bySymbol = new Map();

  for (const entry of deduped.values()) {
    if (cutoffDay && entry.bar.time < cutoffDay) continue;
    candidates.push(entry);
    if (!bySymbol.has(entry.symbol)) bySymbol.set(entry.symbol, []);
    bySymbol.get(entry.symbol).push(entry);
  }

  const sql = `INSERT INTO scanner_candles VALUES(?,?,?,?,?) ON CONFLICT(symbol,timeframe,time) DO UPDATE SET bar_json=excluded.bar_json,source=excluded.source
    WHERE scanner_candles.bar_json<>excluded.bar_json OR scanner_candles.source IS NOT excluded.source`;

  let writtenBars = 0;
  let unchangedBars = 0;
  const touchedSymbols = new Set();

  for (const [symbol, entries] of bySymbol.entries()) {
    const times = entries.map(e => e.bar.time);
    const minT = times.reduce((a, b) => (a < b ? a : b));
    const maxT = times.reduce((a, b) => (a > b ? a : b));

    const existingRows = await storage.all(
      `SELECT time,bar_json,source FROM scanner_candles WHERE symbol=? AND timeframe='1d' AND time>=? AND time<=?`,
      symbol, minT, maxT
    );
    const existingMap = new Map(existingRows.map(r => [r.time, r]));

    const changed = [];
    for (const { bar } of entries) {
      const barJson = JSON.stringify(bar);
      const prev = existingMap.get(bar.time);
      if (prev && prev.bar_json === barJson && prev.source === source) {
        unchangedBars++;
        continue;
      }
      changed.push({ time: bar.time, barJson });
      if (bar.time < minDayWritten) minDayWritten = bar.time;
      if (bar.time > maxDayWritten) maxDayWritten = bar.time;
      touchedSymbols.add(symbol);
    }

    for (let i = 0; i < changed.length; i += 50) {
      const chunk = changed.slice(i, i + 50);
      await storage.batch(chunk.map(item => op(sql, symbol, '1d', item.time, item.barJson, source)));
      writtenBars += chunk.length;
    }
  }

  return {
    status: 'ok',
    source,
    onlyKnown,
    totalInputRows: parsed.totalInputRows,
    skippedInvalidRows: parsed.skippedInvalidRows,
    skippedUnknownSymbols,
    candidateBars: candidates.length,
    writtenBars,
    unchangedBars,
    symbolsUpdated: touchedSymbols.size,
    earliestUpdatedDay: writtenBars ? minDayWritten : null,
    latestUpdatedDay: writtenBars ? maxDayWritten : null,
  };
}

export async function getEodSyncStatus(storage, { catalogCount = DEFAULT_KNOWN_SET.size, ingestSecret = process.env.EOD_INGEST_SECRET } = {}) {
  const agg = await storage.first(
    `SELECT COUNT(DISTINCT symbol) AS symbolCount, COUNT(*) AS totalBars, MIN(time) AS minDay, MAX(time) AS maxDay
     FROM scanner_candles WHERE timeframe='1d'`
  );
  const sources = await storage.all(
    `SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS bars, MAX(time) AS latestDay
     FROM scanner_candles WHERE timeframe='1d' GROUP BY source ORDER BY bars DESC LIMIT 5`
  );
  return {
    catalogCount,
    symbolCount: Number(agg?.symbolCount ?? 0),
    totalBars: Number(agg?.totalBars ?? 0),
    minDay: agg?.minDay ?? null,
    maxDay: agg?.maxDay ?? null,
    sources: sources.map(s => ({ source: s.source, bars: Number(s.bars), latestDay: s.latestDay })),
    ingestSecretConfigured: Boolean(ingestSecret && ingestSecret.length >= 32),
  };
}
