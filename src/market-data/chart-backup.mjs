import { delayedChartSnapshot } from './delayed-candles.mjs';
import { getYahooHistory } from './yahoo-history.mjs';
const failure = code => Object.assign(new Error(code), { code });

export async function loadChartBackup(asset, timeframe, { env = process.env, now = Date.now(), snapshot = delayedChartSnapshot, yahoo = getYahooHistory } = {}) {
  const nativeFlag = asset.id === 'tfex' ? 'TFEX_DISPLAY_RIGHTS_CONFIRMED' : ['thai', 'dr'].includes(asset.id) ? 'SETTRADE_DISPLAY_RIGHTS_CONFIRMED' : null;
  const nativeAllowed = env.NODE_ENV !== 'production' || (nativeFlag ? env[nativeFlag] === 'true' : env.FMP_DISPLAY_RIGHTS_CONFIRMED === 'true' || env.YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED === 'true');
  const yahooAllowed = env.NODE_ENV !== 'production' || env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true';
  if (!nativeAllowed && !yahooAllowed) throw failure('DISPLAY_RIGHTS_NOT_CONFIRMED');
  let cached = nativeAllowed && asset.id !== 'forex' ? await snapshot(asset, timeframe, now) : null;
  if (cached && env.NODE_ENV === 'production' && asset.id === 'us') {
    const allowed = cached.source?.startsWith('Financial Modeling Prep') ? env.FMP_DISPLAY_RIGHTS_CONFIRMED === 'true'
      : cached.source?.startsWith('Yahoo Finance') && env.YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED === 'true';
    if (!allowed) cached = null;
  }
  if (cached && cached.freshness !== 'stale') return cached;
  if (yahooAllowed) {
    try {
      const backup = await yahoo(asset, timeframe);
      if (!cached || Date.parse(backup.dataAsOf) >= Date.parse(cached.dataAsOf)) return backup;
    } catch (error) { if (!cached) throw error; }
  }
  if (cached) return cached;
  throw failure('BACKUP_NOT_AVAILABLE');
}
