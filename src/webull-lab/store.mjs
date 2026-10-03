import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { US_SCAN_SYMBOLS, US_UNIVERSE_METADATA, US_UNIVERSE_VERSION } from '../markets/us-universe.mjs';
export { US_UNIVERSE_VERSION as LAB_UNIVERSE_VERSION };
import { usClock } from '../analysis/us-candles.mjs';

export const LAB_UNIVERSE = US_SCAN_SYMBOLS;
export const LAB_DIRECTORY = () => resolve(process.cwd(), 'data', 'webull', 'lab');
export function credentialScope() {
  return createHash('sha256').update(JSON.stringify([process.env.WEBULL_APP_KEY || '', process.env.WEBULL_APP_SECRET || '',
    process.env.WEBULL_REGION_ID || 'us', process.env.WEBULL_ENVIRONMENT || 'sandbox'])).digest('hex');
}
export function labConfigured() {
  return Boolean(process.env.WEBULL_APP_KEY?.trim() && process.env.WEBULL_APP_SECRET?.trim())
    && (process.env.WEBULL_REGION_ID || 'us') === 'us' && (process.env.WEBULL_ENVIRONMENT || 'sandbox') === 'sandbox';
}
function currentPlan(plan) {
  if (plan?.status !== 'MATCH') return plan;
  const now = Math.floor(Date.now() / 1000), clock = usClock(now);
  const fresh = Number.isFinite(plan.barTime) && now >= plan.barTime + 300
    && now - plan.barTime - 300 <= 20 * 60 && usClock(plan.barTime).day === clock.day
    && clock.minute >= 585 && clock.minute < 960;
  return fresh ? plan : { ...plan, status: 'HISTORICAL_MATCH', recent: false,
    speech: plan.speech ? `ผลจากแท่งย้อนหลัง ${plan.speech}` : null };
}
export async function writeLabFile(name, value) {
  const directory = LAB_DIRECTORY();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = resolve(directory, name), temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, target);
}
async function readScoped(name, limit) {
  try {
    const target = resolve(LAB_DIRECTORY(), name);
    if ((await stat(target)).size > limit) return null;
    const value = JSON.parse(await readFile(target, 'utf8'));
    if (value.credentialScope !== credentialScope() || value.environment !== 'sandbox' || value.region !== 'us') return null;
    return value;
  } catch { return null; }
}
export async function labRun() {
  // 500 per-symbol evaluations exceed the earlier 101-stock report limit.
  const value = await readScoped('run.json', 2_000_000);
  if (!value || value.universeVersion !== US_UNIVERSE_VERSION) return { status: 'IDLE', configured: labConfigured(), environment: 'sandbox', signalEligible: false,
    universeCount: LAB_UNIVERSE.length, universeAsOf: US_UNIVERSE_METADATA.asOf, rows: [] };
  const { credentialScope: _private, ...safe } = value;
  safe.rows = (safe.rows ?? []).map(row => row.plan ? { ...row, plan: currentPlan(row.plan) } : row);
  safe.matches = safe.rows.filter(row => row.plan?.status === 'MATCH').length;
  if (safe.status === 'RUNNING' && Date.now() - Date.parse(safe.updatedAt) > 75_000) {
    safe.status = 'INTERRUPTED'; safe.error = 'SCAN_INTERRUPTED';
  }
  return { ...safe, configured: labConfigured(), signalEligible: false, universeAsOf: US_UNIVERSE_METADATA.asOf };
}
export async function labBars(symbol, runId) {
  if (!LAB_UNIVERSE.includes(symbol)) return null;
  const value = await readScoped(`${symbol}.json`, 400_000);
  if (!value || value.universeVersion !== US_UNIVERSE_VERSION || value.symbol !== symbol || runId && value.runId !== runId || !Array.isArray(value.bars)) return null;
  const bars = value.bars.filter(bar => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)
    && Number.isInteger(bar.time) && bar.time % 60 === 0 && bar.time + 60 <= Date.now() / 1000
    && Math.min(bar.open, bar.high, bar.low, bar.close) > 0 && bar.high >= Math.max(bar.open, bar.close, bar.low)
    && bar.low <= Math.min(bar.open, bar.close) && bar.volume >= 0);
  if (bars.length !== value.bars.length || bars.length > 1200 || bars.some((bar, i) => i && bar.time <= bars[i - 1].time)) return null;
  const { credentialScope: _private, ...safe } = value;
  return { ...safe, bars, plan: currentPlan(safe.plan), signalEligible: false };
}
