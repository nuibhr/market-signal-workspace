// Standalone zero-dependency Office PC -> Cloud HTTPS EOD Delta Pusher (copy ONLY this 1 file to the office PC).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidEodBar(bar) {
  if (!bar || !ISO_DAY_RE.test(String(bar.time ?? ''))) return false;
  const parsed = Date.parse(bar.time);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== bar.time) return false;
  const { open, high, low, close, volume } = bar;
  if (![open, high, low, close].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return false;
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0) return false;
  if (high < Math.max(open, close, low) || low > Math.min(open, close)) return false;
  return true;
}

function parseEodCsvRows(csvText) {
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
      if ([timeIdx, symIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx].some(idx => idx < 0)) {
        throw new Error('UNRECOGNIZED_EOD_CSV_HEADER');
      }
      col = { timeIdx, symIdx, openIdx, highIdx, lowIdx, closeIdx, volIdx };
      continue;
    }
    totalInputRows++;
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
 * Filter raw Metabase CSV down to trailing `days` calendar days and normalized rows for lightweight upload.
 */
export function prepareTailEodPayload(csvText, { days = 14, onlyKnown = true, source = 'Metabase Office Push' } = {}) {
  const parsed = parseEodCsvRows(csvText);
  let maxDay = '0000-00-00';
  for (const r of parsed.records) {
    if (r.bar.time > maxDay) maxDay = r.bar.time;
  }

  let cutoff = null;
  if (Number.isFinite(days) && days > 0 && maxDay !== '0000-00-00') {
    cutoff = new Date(Date.parse(`${maxDay}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  }

  const rows = [];
  for (const { symbol, bar } of parsed.records) {
    if (cutoff && bar.time < cutoff) continue;
    rows.push({ symbol, ...bar });
  }

  return {
    source,
    onlyKnown,
    rows,
    stats: {
      totalInputRows: parsed.totalInputRows,
      skippedInvalidRows: parsed.skippedInvalidRows,
      tailRows: rows.length,
      maxDay,
      cutoff,
    },
  };
}

export async function pushEodPayload({ targetUrl, ingestSecret, payload, fetcher = fetch }) {
  if (!targetUrl) throw new Error('EOD_TARGET_URL_REQUIRED');
  if (!ingestSecret || ingestSecret.length < 32) throw new Error('EOD_INGEST_SECRET_REQUIRED_MIN_32_CHARS');
  const endpoint = `${targetUrl.replace(/\/+$/, '')}/api/admin/eod-sync`;
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ingestSecret}`,
    },
    body: JSON.stringify({
      source: payload.source,
      onlyKnown: payload.onlyKnown,
      rows: payload.rows,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`PUSH_FAILED_${response.status}:${body.error || 'UNKNOWN'}`);
  }
  return body;
}

async function fetchMetabaseCsv({ metabaseUrl, cardId, apiKey, fetcher = fetch }) {
  if (!metabaseUrl || !cardId || !apiKey) {
    throw new Error('METABASE_URL, METABASE_CARD_ID, and METABASE_API_KEY are required');
  }
  const url = `${metabaseUrl.replace(/\/+$/, '')}/api/card/${encodeURIComponent(cardId)}/query/csv`;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) {
    throw new Error(`METABASE_HTTP_${response.status}`);
  }
  return response.text();
}

function loadPushState(statePath) {
  try {
    if (existsSync(statePath)) return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {}
  return {};
}

function savePushState(statePath, state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function runCli() {
  const args = process.argv.slice(2);
  const opt = (name, fallback = null) => {
    const hit = args.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : fallback;
  };
  const hasFlag = name => args.includes(`--${name}`);

  const targetUrl = opt('target', process.env.EOD_TARGET_URL || 'http://localhost:3001');
  const ingestSecret = opt('secret', process.env.EOD_INGEST_SECRET || '');
  const days = Number(opt('days', '14'));
  const onlyKnown = !hasFlag('all-symbols');

  if (hasFlag('metabase')) {
    const csvText = await fetchMetabaseCsv({
      metabaseUrl: opt('metabase-url', process.env.METABASE_URL),
      cardId: opt('card-id', process.env.METABASE_CARD_ID),
      apiKey: opt('metabase-key', process.env.METABASE_API_KEY),
    });
    const payload = prepareTailEodPayload(csvText, { days, onlyKnown, source: 'Metabase Office API' });
    const res = await pushEodPayload({ targetUrl, ingestSecret, payload });
    console.log(JSON.stringify({ mode: 'metabase', ...payload.stats, syncResult: res }, null, 2));
    return;
  }

  const fileArg = opt('file', null);
  if (fileArg) {
    const csvText = readFileSync(resolve(fileArg), 'utf8');
    const payload = prepareTailEodPayload(csvText, { days, onlyKnown, source: 'Metabase Office CSV' });
    const res = await pushEodPayload({ targetUrl, ingestSecret, payload });
    console.log(JSON.stringify({ mode: 'file', file: resolve(fileArg), ...payload.stats, syncResult: res }, null, 2));
    return;
  }

  const watchDir = opt('watch', null);
  if (watchDir) {
    const absDir = resolve(watchDir);
    const statePath = join(absDir, '.eod-push-state.json');
    const state = loadPushState(statePath);

    const scanFolder = async () => {
      const files = readdirSync(absDir)
        .filter(f => extname(f).toLowerCase() === '.csv' && !f.startsWith('.'))
        .sort();
      for (const name of files) {
        const full = join(absDir, name);
        let st;
        try { st = statSync(full); } catch { continue; }
        if (!st.isFile()) continue;
        const text = readFileSync(full, 'utf8');
        const sha = createHash('sha256').update(text).digest('hex');
        if (state[name]?.sha === sha) continue;
        try {
          const payload = prepareTailEodPayload(text, { days, onlyKnown, source: 'Metabase Folder Watch' });
          const res = await pushEodPayload({ targetUrl, ingestSecret, payload });
          state[name] = { sha, pushedAt: new Date().toISOString(), writtenBars: res.writtenBars };
          savePushState(statePath, state);
          console.log(JSON.stringify({ event: 'pushed', file: name, ...payload.stats, writtenBars: res.writtenBars, unchangedBars: res.unchangedBars }));
        } catch (err) {
          console.error(JSON.stringify({ event: 'error', file: name, message: err.message }));
        }
      }
    };

    await scanFolder();
    if (hasFlag('once')) return;
    console.log(`Watching ${absDir} for Metabase EOD CSV updates (trailing ${days}d -> ${targetUrl})...`);
    let timer = null;
    watch(absDir, () => {
      clearTimeout(timer);
      timer = setTimeout(() => { scanFolder().catch(e => console.error(e.message)); }, 1200);
    });
    return;
  }

  console.error(
    'Usage:\n' +
    '  node scripts/office-eod-push.mjs --file=~/Downloads/stock.csv --target=https://your-site --secret=$EOD_INGEST_SECRET [--days=14]\n' +
    '  node scripts/office-eod-push.mjs --watch=~/Downloads/eod-inbox --target=https://your-site --secret=$EOD_INGEST_SECRET [--days=14]\n' +
    '  node scripts/office-eod-push.mjs --metabase --target=https://your-site --secret=$EOD_INGEST_SECRET'
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
