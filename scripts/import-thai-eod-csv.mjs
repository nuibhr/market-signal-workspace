// Clean, filter, seed, and prepare SET/mai EOD CSV history (1d) for local SQLite & Cloudflare D1.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import readline from 'node:readline';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check whether an OHLCV daily bar is strictly valid for Stage 2 / backtest math.
 */
export function isValidDailyBar(bar) {
  if (!bar || !ISO_DAY_RE.test(bar.time)) return false;
  const parsed = Date.parse(bar.time);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== bar.time) return false;
  const { open, high, low, close, volume } = bar;
  if (![open, high, low, close].every(n => Number.isFinite(n) && n > 0)) return false;
  if (!Number.isFinite(volume) || volume < 0) return false;
  if (high < Math.max(open, close, low) || low > Math.min(open, close)) return false;
  return true;
}

function addDaysIso(day, deltaDays) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + deltaDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Process an async line iterator (SET CSV format: D_TRADE,N_SECURITY,Z_OPEN,Z_HIGH,Z_LOW,Z_CLOSE,Q_VOLUME)
 * and return qualified Thai stocks/funds plus clean recent bars.
 */
export async function filterThaiEodLines(lines, options = {}) {
  const {
    minPrice = 2,
    minAvgDailyValueThb = 5_000_000,
    liquidityWindow = 20,
    minBars = 252,
    maxBars = 350,
    includeFunds = true,
    activeDaysWindow = 45,
    fundPattern = /(IF|REIT|PF|GROW|WORK|CHAI)$|-/,
  } = options;

  let col = null;
  let totalRows = 0;
  let skippedZeroOrInvalid = 0;
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';
  const bySymbol = new Map();

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(',');
    if (!col) {
      const headers = parts.map(h => h.replace(/^\uFEFF/, '').trim().toUpperCase());
      const timeIdx = headers.indexOf('D_TRADE') >= 0 ? headers.indexOf('D_TRADE') : headers.indexOf('TIME');
      const symIdx = headers.indexOf('N_SECURITY') >= 0 ? headers.indexOf('N_SECURITY') : headers.indexOf('SYMBOL');
      const openIdx = headers.indexOf('Z_OPEN') >= 0 ? headers.indexOf('Z_OPEN') : headers.indexOf('OPEN');
      const highIdx = headers.indexOf('Z_HIGH') >= 0 ? headers.indexOf('Z_HIGH') : headers.indexOf('HIGH');
      const lowIdx = headers.indexOf('Z_LOW') >= 0 ? headers.indexOf('Z_LOW') : headers.indexOf('LOW');
      const closeIdx = headers.indexOf('Z_CLOSE') >= 0 ? headers.indexOf('Z_CLOSE') : headers.indexOf('CLOSE');
      const volIdx = headers.indexOf('Q_VOLUME') >= 0 ? headers.indexOf('Q_VOLUME') : headers.indexOf('VOLUME');
      if ([timeIdx, symIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx].some(idx => idx < 0)) {
        throw new Error('UNRECOGNIZED_EOD_CSV_HEADER');
      }
      col = { timeIdx, symIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx };
      continue;
    }

    totalRows++;
    const time = parts[col.timeIdx]?.trim();
    const symbol = parts[col.symIdx]?.trim().toUpperCase();
    const bar = {
      time,
      open: Number(parts[col.openIdx]),
      high: Number(parts[col.highIdx]),
      low: Number(parts[col.lowIdx]),
      close: Number(parts[col.closeIdx]),
      volume: Number(parts[col.volIdx]),
    };

    if (!symbol || !isValidDailyBar(bar)) {
      skippedZeroOrInvalid++;
      continue;
    }
    if (time < minDate) minDate = time;
    if (time > maxDate) maxDate = time;

    let series = bySymbol.get(symbol);
    if (!series) {
      series = new Map();
      bySymbol.set(symbol, series);
    }
    series.set(time, bar);
  }

  if (!col || maxDate === '0000-00-00') {
    throw new Error('EMPTY_EOD_CSV');
  }

  const activeCutoff = addDaysIso(maxDate, -activeDaysWindow);
  const qualified = [];
  const anomalies = [];

  for (const [symbol, barMap] of bySymbol.entries()) {
    if (!includeFunds && fundPattern.test(symbol)) continue;
    const sorted = [...barMap.values()].sort((a, b) => a.time.localeCompare(b.time));
    const tail = sorted.slice(-maxBars);
    const last = tail.at(-1);
    if (!last || last.time < activeCutoff || tail.length < minBars || last.close < minPrice) continue;

    const liqSlice = tail.slice(-liquidityWindow);
    const avgDailyValueThb = liqSlice.reduce((sum, b) => sum + b.close * b.volume, 0) / liqSlice.length;
    if (avgDailyValueThb < minAvgDailyValueThb) continue;

    for (let i = 1; i < tail.length; i++) {
      const ratio = tail[i].close / tail[i - 1].close;
      if (ratio < 0.45 || ratio > 2.2) {
        anomalies.push({ symbol, time: tail[i].time, prevClose: tail[i - 1].close, close: tail[i].close });
      }
    }

    qualified.push({
      symbol,
      bars: tail,
      lastDate: last.time,
      lastClose: last.close,
      avgDailyValueThb: Math.round(avgDailyValueThb),
      isFund: /(IF|REIT|PF|GROW|WORK|CHAI)$|-WORK|-STOR/.test(symbol),
    });
  }

  qualified.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return {
    totalRows,
    skippedZeroOrInvalid,
    uniqueValidSymbols: bySymbol.size,
    minDate,
    maxDate,
    activeCutoff,
    qualified,
    anomalies,
  };
}

export async function filterThaiEodCsvText(csvText, options = {}) {
  const lines = String(csvText ?? '').split(/\r?\n/);
  return filterThaiEodLines(lines, options);
}

export async function filterThaiEodFile(csvPath, options = {}) {
  const stream = createReadStream(resolve(csvPath), { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  return filterThaiEodLines(rl, options);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function writeD1SqlChunks(outDir, prefix, records, rowsPerChunk = 10_000, batchSize = 50) {
  mkdirSync(outDir, { recursive: true });
  const files = [];
  for (let offset = 0, part = 1; offset < records.length; offset += rowsPerChunk, part++) {
    const chunk = records.slice(offset, offset + rowsPerChunk);
    const filePath = resolve(outDir, `${prefix}-part-${String(part).padStart(2, '0')}.sql`);
    const lines = [];
    for (let i = 0; i < chunk.length; i += batchSize) {
      const values = chunk.slice(i, i + batchSize).map(r =>
        `(${sqlLiteral(r.symbol)},'1d',${sqlLiteral(r.time)},${sqlLiteral(r.barJson)},'SET EOD Historical')`
      ).join(',');
      lines.push(
        `INSERT INTO scanner_candles(symbol,timeframe,time,bar_json,source) VALUES ${values} ` +
        `ON CONFLICT(symbol,timeframe,time) DO UPDATE SET bar_json=excluded.bar_json,source=excluded.source;`
      );
    }
    writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    files.push({ filePath, rows: chunk.length });
  }
  return files;
}

async function runCli() {
  const args = process.argv.slice(2);
  const csvPath = args.find(a => !a.startsWith('--'));
  if (!csvPath) {
    console.error('Usage: node scripts/import-thai-eod-csv.mjs <csv-path> [--write-catalog] [--seed-db] [--emit-sql] [--min-price=2] [--min-value=5000000] [--max-bars=350]');
    process.exit(1);
  }
  const flag = name => args.includes(`--${name}`);
  const numOpt = (name, fallback) => {
    const hit = args.find(a => a.startsWith(`--${name}=`));
    return hit ? Number(hit.split('=')[1]) : fallback;
  };

  const minPrice = numOpt('min-price', 2);
  const minAvgDailyValueThb = numOpt('min-value', 5_000_000);
  const maxBars = numOpt('max-bars', 350);

  const report = await filterThaiEodFile(csvPath, {
    minPrice,
    minAvgDailyValueThb,
    maxBars,
    includeFunds: !flag('no-funds'),
  });

  const { SET100_SYMBOLS, MAI_INITIAL_SYMBOLS } = await import('../src/markets/catalog.mjs');
  const existing = new Set([...SET100_SYMBOLS, ...MAI_INITIAL_SYMBOLS]);
  const extendedSymbols = report.qualified
    .map(q => q.symbol)
    .filter(s => !existing.has(s))
    .sort((a, b) => a.localeCompare(b));

  const out = {
    sourceFile: resolve(csvPath),
    totalRows: report.totalRows,
    skippedZeroOrInvalid: report.skippedZeroOrInvalid,
    dateRange: `${report.minDate}..${report.maxDate}`,
    qualifiedCount: report.qualified.length,
    extendedNewCount: extendedSymbols.length,
    fundCount: report.qualified.filter(q => q.isFund).length,
    anomaliesInWindow: report.anomalies,
    maxBarsPerSymbol: maxBars,
  };

  if (flag('write-catalog')) {
    const catalogPath = resolve('src/markets/thai-liquid-extended.mjs');
    const metadata = {
      asOf: report.maxDate,
      minPriceThb: minPrice,
      minAvgDailyValueThb,
      includeFunds: !flag('no-funds'),
      qualifiedTotalInCsv: report.qualified.length,
      extendedCount: extendedSymbols.length,
      maxSeedBars: maxBars,
      source: 'SET EOD Historical CSV',
    };
    const fileContent =
      `// Generated by scripts/import-thai-eod-csv.mjs from curated SET/mai EOD data.\n` +
      `export const THAI_LIQUID_EXTENDED_METADATA = ${JSON.stringify(metadata, null, 2)};\n` +
      `export const THAI_LIQUID_EXTENDED_SYMBOLS = ${JSON.stringify(extendedSymbols, null, 2)};\n`;
    writeFileSync(catalogPath, fileContent, 'utf8');
    out.wroteCatalog = catalogPath;
  }

  if (flag('seed-db')) {
    const { sqliteDatabase } = await import('../src/storage/sqlite.mjs');
    const db = sqliteDatabase();
    const stmt = db.prepare(
      `INSERT INTO scanner_candles(symbol,timeframe,time,bar_json,source) VALUES (?,?,?,?,?)
       ON CONFLICT(symbol,timeframe,time) DO UPDATE SET bar_json=excluded.bar_json,source=excluded.source`
    );
    let inserted = 0;
    db.exec('BEGIN');
    try {
      for (const item of report.qualified) {
        for (const bar of item.bars) {
          stmt.run(item.symbol, '1d', bar.time, JSON.stringify(bar), 'SET EOD Historical');
          inserted++;
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    out.seededSqliteRows = inserted;
  }

  if (flag('emit-sql')) {
    const sqlDir = resolve('data/thai-eod-d1');
    const allRecords = report.qualified.flatMap(item =>
      item.bars.map(bar => ({ symbol: item.symbol, time: bar.time, barJson: JSON.stringify(bar) }))
    );
    const extendedSet = new Set(extendedSymbols);
    const newOnlyRecords = report.qualified
      .filter(item => extendedSet.has(item.symbol))
      .flatMap(item => item.bars.map(bar => ({ symbol: item.symbol, time: bar.time, barJson: JSON.stringify(bar) })));

    out.d1SqlAll = writeD1SqlChunks(sqlDir, 'all-qualified-1d', allRecords, 10_000, 50);
    out.d1SqlExtendedOnly = writeD1SqlChunks(sqlDir, 'extended-77-1d', newOnlyRecords, 10_000, 50);
  }

  console.log(JSON.stringify(out, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
