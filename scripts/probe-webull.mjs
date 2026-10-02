import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.WEBULL_PYTHON_PATH || `${root}data/webull-sdk/bin/python`;
if (!existsSync(python)) {
  console.error('Webull SDK runtime missing. See docs/webull-sdk-connection.md for installation.');
  process.exit(1);
}
const args = process.argv.slice(2);
const mode = ['probe', 'stream', 'matrix'].includes(args[0]) ? args.shift() : 'probe';
// Node reads .env.local; Python receives credentials through env, never command arguments.
// Isolate it from other providers' credentials and from browser/server startup.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'HOME', 'LANG', 'SSL_CERT_FILE'].includes(key) || key.startsWith('WEBULL_')));
env.PYTHONUNBUFFERED = '1';
const child = spawn(python, [`${root}scripts/webull-market-data.py`, mode, ...args], {
  cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false,
});
// Emit only parsed, allowlisted JSON from our adapter. SDK stderr can include signed headers.
const fields = new Set(['stage', 'status', 'code', 'httpStatus', 'errorType', 'region', 'environment',
  'httpHost', 'mqttHost', 'twoFactorRequired', 'responseMs', 'symbol', 'price', 'bid', 'ask',
  'observedAt', 'sourceAgeSeconds', 'signalEligible', 'requestedBars', 'receivedBars',
  'closedValidBars', 'timeframe', 'oldestTime', 'latestTime', 'lastClose', 'tls', 'topic',
  'topics', 'durationLimitSeconds', 'connected', 'subscribed', 'messages', 'pricedMessages',
  'version', 'readOnly']);
let buffer = '';
const records = [];
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  buffer += chunk;
  if (buffer.length > 100_000) { child.kill('SIGTERM'); return; }
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
    try {
      const row = JSON.parse(line);
      const safe = Object.fromEntries(Object.entries(row).filter(([key]) => fields.has(key)));
      if (Object.keys(safe).length) {
        records.push(safe);
        process.stdout.write(`${JSON.stringify(safe)}\n`);
      }
    } catch { /* Discard all SDK log output. */ }
  }
});
child.stderr.resume();
const timeout = setTimeout(() => {
  process.stdout.write(`${JSON.stringify({ status: 'unavailable', code: 'PROBE_TIMEOUT' })}\n`);
  child.kill('SIGKILL');
}, 90_000);
child.on('error', () => {
  clearTimeout(timeout);
  console.error('Webull SDK runtime could not start.'); process.exitCode = 1;
});
child.on('close', async code => {
  clearTimeout(timeout);
  process.exitCode = code === 0 ? 0 : 1;
  try {
    const directory = `${root}data/webull/reports`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const target = `${directory}/${mode}.json`;
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify({ checkedAt: new Date().toISOString(),
      success: code === 0, mode, records,
      credentialScope: createHash('sha256').update(JSON.stringify([
        process.env.WEBULL_APP_KEY || '', process.env.WEBULL_APP_SECRET || '',
        process.env.WEBULL_REGION_ID || 'us', process.env.WEBULL_ENVIRONMENT || 'sandbox',
      ])).digest('hex'),
    }, null, 2), { mode: 0o600 });
    await rename(temporary, target);
  } catch { console.error('Could not save the local Webull diagnostic report.'); }
});
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));
