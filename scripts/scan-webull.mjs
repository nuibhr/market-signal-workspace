import { spawn } from 'node:child_process';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LAB_DIRECTORY, LAB_UNIVERSE, LAB_UNIVERSE_VERSION, credentialScope, labConfigured, labRun, writeLabFile } from '../src/webull-lab/store.mjs';
import { LAB_RULE_VERSION, labEvaluation } from '../src/webull-lab/engine.mjs';

// Background process survives HTTP response completion, but each round is bounded.
const root = process.cwd(), scope = credentialScope();
const python = process.env.WEBULL_PYTHON_PATH || resolve(root, 'data', 'webull-sdk', 'bin', 'python');
const adapter = resolve(root, 'scripts', 'webull-bars.py');
const directory = LAB_DIRECTORY(), lockPath = resolve(directory, 'scan.lock');
const runId = randomUUID();
const hardDeadline = Date.now() + 12 * 60_000;
let runningChild = null, ownsLock = false;
let abortRequested = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { abortRequested = true; runningChild?.kill('SIGTERM'); });
const args = process.argv.slice(2);
const symbolArg = args.find(value => value.startsWith('--symbols='));
const symbols = symbolArg ? [...new Set(symbolArg.slice(10).split(','))] : [...LAB_UNIVERSE];
if (!symbols.length || symbols.some(symbol => !LAB_UNIVERSE.includes(symbol))) {
  console.error('Invalid US universe selection.'); process.exit(1);
}
const sleep = ms => new Promise(done => setTimeout(done, ms));
const state = { runId, credentialScope: scope, region: 'us', environment: 'sandbox', signalEligible: false,
  universeVersion: LAB_UNIVERSE_VERSION, ruleVersion: LAB_RULE_VERSION, timeframe: '1m', requestedBars: 1200, universeCount: symbols.length,
  startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null,
  status: 'RUNNING', processed: 0, available: 0, missing: 0, matches: 0, rows: [] };
async function save() { state.updatedAt = new Date().toISOString(); await writeLabFile('run.json', state); }
async function acquire() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const previous = JSON.parse(await readFile(lockPath, 'utf8'));
    let alive = false;
    if (Number.isInteger(previous.pid)) { try { process.kill(previous.pid, 0); alive = true; } catch {} }
    const age = Date.now() - Date.parse(previous.createdAt);
    if (age < 30_000 || alive && age < 15 * 60_000) return false;
    await unlink(lockPath);
  } catch (error) { if (error.code !== 'ENOENT') return false; }
  try {
    const handle = await open(lockPath, 'wx', 0o600);
    ownsLock = true;
    await handle.writeFile(JSON.stringify({ runId, pid: process.pid, createdAt: new Date().toISOString() }));
    await handle.close();
    return true;
  } catch { return false; }
}
let waiting = null;
function sdkResponse(result) {
  const known = new Set(['SANDBOX_US_REQUIRED', 'NOT_CONFIGURED', 'INVALID_SYMBOLS', 'AUTH_UNAVAILABLE',
    'BARS_UNAVAILABLE', 'MOBILE_APPROVAL_REQUIRED', 'INVALID_RESPONSE', 'SDK_REQUEST_FAILED']);
  if (result.error) return { error: known.has(result.error) ? result.error : 'SDK_REQUEST_FAILED',
    httpStatus: Number.isInteger(result.httpStatus) ? result.httpStatus : null,
    providerCode: result.providerCode === 'INVALID_SYMBOL' ? 'INVALID_SYMBOL' : null };
  if (result.environment === 'sandbox' && result.region === 'us' && result.timeframe === '1m' && Array.isArray(result.records)) return result;
  return { error: 'INVALID_RESPONSE' };
}
function startAdapter() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ['PATH', 'HOME', 'LANG', 'SSL_CERT_FILE'].includes(key) || key.startsWith('WEBULL_')));
  env.PYTHONUNBUFFERED = '1';
  const child = spawn(python, [adapter, '--worker'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  runningChild = child;
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 2_000_000) { child.kill('SIGKILL'); if (waiting?.child === child) waiting.finish({ error: 'RESPONSE_TOO_LARGE' }); return; }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try { const result = JSON.parse(line); if (waiting?.child === child) waiting.finish(sdkResponse(result)); }
      catch { if (waiting?.child === child) waiting.finish({ error: 'INVALID_RESPONSE' }); }
    }
  });
  child.stderr.resume(); // Never forward signed headers, tokens or raw exceptions.
  child.stdin.on('error', () => { if (waiting?.child === child) waiting.finish({ error: 'SDK_RUNTIME_UNAVAILABLE' }); });
  child.on('error', () => { if (waiting?.child === child) waiting.finish({ error: 'SDK_RUNTIME_UNAVAILABLE' }); });
  child.on('close', () => {
    if (runningChild === child) runningChild = null;
    if (waiting?.child === child) waiting.finish({ error: 'SDK_REQUEST_FAILED' });
  });
  return child;
}
function requestBars(batch) {
  return new Promise(done => {
    const child = runningChild || startAdapter();
    const timeout = setTimeout(() => { if (runningChild === child) runningChild = null; child.kill('SIGKILL'); finish({ error: 'SDK_TIMEOUT' }); }, 35_000);
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true; clearTimeout(timeout); waiting = null; done(result);
    };
    waiting = { finish, child };
    child.stdin.write(`${JSON.stringify({ symbols: batch })}\n`);
  });
}
function validateBars(input) {
  if (!Array.isArray(input) || input.length > 1200) return [];
  const valid = input.every((bar, i) => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)
    && Number.isInteger(bar.time) && bar.time % 60 === 0 && bar.time + 60 <= Date.now() / 1000
    && Math.min(bar.open, bar.high, bar.low, bar.close) > 0 && bar.high >= Math.max(bar.open, bar.close, bar.low)
    && bar.low <= Math.min(bar.open, bar.close) && bar.volume >= 0 && (!i || bar.time > input[i - 1].time));
  return valid ? input.map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume })) : [];
}
function missing(symbol, error) { state.rows.push({ symbol, status: 'unavailable', code: error, count: 0 }); state.missing += 1; state.processed += 1; }

try {
  if (!labConfigured()) { console.error('US Sandbox credentials required.'); process.exitCode = 1; }
  else if (await acquire()) {
    const previous = await labRun();
    // One complete app-key round per five minutes, even if many admin tabs click.
    if (previous.startedAt && Date.now() - Date.parse(previous.startedAt) < 300_000 && previous.status !== 'INTERRUPTED') {
      console.log('Sandbox scan cooldown active.');
    } else {
      await save();
      let stopped = null;
      const queue = [];
      for (let i = 0; i < symbols.length; i += 5) queue.push({ batch: symbols.slice(i, i + 5), attempt: 0 });
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        if (abortRequested) { stopped = 'SCAN_INTERRUPTED'; break; }
        if (Date.now() >= hardDeadline) { stopped = 'ROUND_TIMEOUT'; break; }
        const { batch, attempt } = queue[cursor], started = Date.now();
        const response = await requestBars(batch);
        if (response.error) {
          const fatal = [401, 403, 429].includes(response.httpStatus) || ['SDK_RUNTIME_UNAVAILABLE', 'MOBILE_APPROVAL_REQUIRED', 'AUTH_UNAVAILABLE'].includes(response.error);
          if (fatal) {
            stopped = response.httpStatus === 429 ? 'RATE_LIMITED' : response.error;
            for (const symbol of batch) missing(symbol, stopped);
          } else if (batch.length > 1 && response.providerCode === 'INVALID_SYMBOL') {
            // One unsupported security must not quarantine the other four.
            for (const symbol of batch) queue.push({ batch: [symbol], attempt: 1 });
          } else if (attempt === 0) queue.push({ batch, attempt: 1 });
          else for (const symbol of batch) missing(symbol, response.providerCode || response.error);
        } else for (const symbol of batch) {
          const matched = response.records.filter(record => record.symbol === symbol);
          const row = matched.length === 1 ? matched[0] : null;
          const bars = validateBars(row?.bars);
          if (!bars.length || row?.conflicts > 0 || row?.rejected > 0) { missing(symbol, bars.length ? 'INVALID_BAR_DATA' : 'NO_BARS'); continue; }
          const evaluation = labEvaluation(symbol, bars);
          await writeLabFile(`${symbol}.json`, { runId, universeVersion: LAB_UNIVERSE_VERSION, credentialScope: scope, symbol, region: 'us', environment: 'sandbox',
            source: 'Webull SDK Sandbox', timeframe: '1m', requestedBars: 1200,
            receivedAt: response.receivedAt, responseMs: response.responseMs,
            delayMinutes: Number.isFinite(row.delayMinutes) ? row.delayMinutes : null, bars, ...evaluation });
          state.rows.push({ symbol, status: 'available', count: bars.length, fiveMinuteCount: evaluation.fiveMinuteCount,
            latestTime: bars.at(-1).time, lastClose: bars.at(-1).close, plan: evaluation.plan,
            replay: { entries: evaluation.replay.entries, resolved: evaluation.replay.resolved,
              wins: evaluation.replay.wins, losses: evaluation.replay.losses, unresolved: evaluation.replay.unresolved } });
          state.available += 1; state.processed += 1;
          if (evaluation.plan.status === 'MATCH') state.matches += 1;
        }
        await save();
        if (stopped) break;
        // 20/min maximum, leaving room under the shared 30/min bars quota.
        if (cursor + 1 < queue.length) await sleep(Math.max(0, 3000 - (Date.now() - started)));
      }
      for (const symbol of symbols) if (!state.rows.some(row => row.symbol === symbol)) missing(symbol, stopped || 'NOT_PROCESSED');
      state.status = stopped === 'SCAN_INTERRUPTED' ? 'INTERRUPTED' : state.missing ? 'PARTIAL' : 'COMPLETE'; state.error = stopped;
      state.finishedAt = new Date().toISOString(); await save();
      console.log(JSON.stringify({ status: state.status, available: state.available, missing: state.missing,
        universeCount: state.universeCount, matches: state.matches, environment: 'sandbox' }));
    }
  } else console.log('A Sandbox scan is already running.');
} catch {
  process.exitCode = 1;
  if (ownsLock) { state.status = 'FAILED'; state.error = 'SCAN_FAILED'; state.finishedAt = new Date().toISOString(); await save().catch(() => {}); }
  console.error('Sandbox scan failed; check the admin status.');
} finally {
  runningChild?.kill('SIGTERM');
  if (ownsLock) await unlink(lockPath).catch(() => {});
}
