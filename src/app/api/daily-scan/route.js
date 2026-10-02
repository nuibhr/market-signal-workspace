import { rateLimit } from '../../../security/request-guard.mjs';
import { sharedDatabase } from '../../../membership/store.mjs';
import { customerSummary } from '../../../analysis/customer-summary.mjs';
import { analyzeCandles } from '../../../analysis/technical.mjs';
import { SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';
import { currentMember } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';
import { assessDailySeries, createSettradeClient, SettradeDataError } from '../../../market-data/settrade.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const client = createSettradeClient();
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

function todayInBangkok() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request) {
  const member = await currentMember();
  const rights = membershipFor(member);
  if (!rights.capabilities.manualDailyScan) return Response.json({ status: 'forbidden', code: 'MEMBERSHIP_REQUIRED' }, { status: 403, headers: HEADERS });
  const db = sharedDatabase();
  db.exec('CREATE TABLE IF NOT EXISTS customer_daily_reports(member_id TEXT PRIMARY KEY, report_json TEXT NOT NULL)');
  if (new URL(request.url).searchParams.get('saved') === '1') {
    const row = db.prepare('SELECT report_json FROM customer_daily_reports WHERE member_id=?').get(member.id);
    return Response.json(row ? JSON.parse(row.report_json) : { status: 'empty', results: [] }, { headers: HEADERS });
  }
  const limited = rateLimit('daily-scan', member.id, 3); if (limited) return limited;
  const requested = (new URL(request.url).searchParams.get('symbols') ?? 'PTT,AOT,CPALL,KBANK,SCB,ADVANC')
    .split(',').map(symbol => symbol.trim().toUpperCase()).filter(Boolean);
  const symbols = [...new Set(requested)];
  if (!symbols.length || symbols.length > rights.limits.dailyScanSymbols || symbols.some(symbol => !SETTRADE_SYMBOLS.has(symbol))) {
    return Response.json({ status: 'invalid', code: 'INVALID_SYMBOLS', maxSymbols: rights.limits.dailyScanSymbols }, { status: 400, headers: HEADERS });
  }
  if (process.env.NODE_ENV === 'production' && process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_NOT_CONFIRMED' }, { status: 503, headers: HEADERS });
  }
  if (!client.configuration.configured) {
    return Response.json({ status: 'unavailable', code: 'SOURCE_NOT_CONFIGURED' }, { status: 503, headers: HEADERS });
  }
  try {
    await client.login();
  } catch (error) {
    const code = error instanceof SettradeDataError ? error.code : 'SOURCE_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: HEADERS });
  }

  const today = todayInBangkok();
  const results = [];
  // Keep calls bounded and serial to respect the upstream feed and shared token.
  for (const symbol of symbols) {
    try {
      const series = await client.getCandles(symbol, '1d', 250);
      const bars = series.bars.filter(bar => bar.time < today);
      const assessment = assessDailySeries({ ...series, bars });
      const analysis = analyzeCandles(bars, null, 'รายวัน');
      results.push({
        symbol,
        status: analysis ? 'available' : 'insufficient',
        freshness: assessment.freshness,
        signalEligible: assessment.signalEligible,
        latestDay: assessment.latestDay,
        source: series.source,
        price: analysis?.price ?? null,
        trend: analysis?.trend ?? null,
        rsi14: analysis?.rsi14 ?? null,
        support: analysis?.support ?? null,
        resistance: analysis?.resistance ?? null,
        summary: customerSummary(analysis, assessment.signalEligible),
        plan: analysis?.plan ?? null,
        conditions: analysis?.events?.filter(event => event.tone !== 'flat').map(event => ({ tone: event.tone, label: event.label })) ?? [],
      });
    } catch (error) {
      results.push({ symbol, status: 'unavailable', code: error instanceof SettradeDataError ? error.code : 'SOURCE_UNAVAILABLE' });
    }
  }
  const report = { status: 'complete', tier: rights.tier, scannedAt: new Date().toISOString(), timeframe: '1d', results };
  db.prepare('INSERT INTO customer_daily_reports VALUES(?,?) ON CONFLICT(member_id) DO UPDATE SET report_json=excluded.report_json').run(member.id, JSON.stringify(report));
  return Response.json(report, { headers: HEADERS });
}
