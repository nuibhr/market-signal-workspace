import { readFileSync } from 'node:fs';
import { assessDailySeries, createSettradeClient, SettradeDataError } from '../src/market-data/settrade.mjs';

const args = process.argv.slice(2);
const fileFlag = args.indexOf('--credentials-file');
let env = process.env;
if (fileFlag !== -1) {
  const file = args[fileFlag + 1];
  if (!file) {
    process.stdout.write('{"stage":"configuration","state":"CREDENTIAL_FILE_MISSING"}\n');
    process.exit(1);
  }
  try {
    const allowlist = new Set(['SETTRADE_BROKER_ID', 'SETTRADE_APP_CODE', 'BROKER_APP_ID', 'BROKER_API_SECRET', 'SETTRADE_APP_ID', 'SETTRADE_APP_SECRET']);
    const selected = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match || !allowlist.has(match[1])) continue;
      selected[match[1]] = match[2].trim().replace(/^("|')(.*)\1$/, '$2');
    }
    env = selected;
  } catch {
    process.stdout.write('{"stage":"configuration","state":"CREDENTIAL_FILE_UNREADABLE"}\n');
    process.exit(1);
  }
  args.splice(fileFlag, 2);
}
const symbols = args;
const requested = symbols.length ? symbols : ['PTT', 'AAPL80'];
const client = createSettradeClient({ env });

function result(row) {
  process.stdout.write(`${JSON.stringify(row)}\n`);
}

function safeError(error) {
  return error instanceof SettradeDataError
    ? { state: error.code, httpStatus: error.status }
    : { state: 'UNEXPECTED_FAILURE' };
}

result({ stage: 'configuration', configured: client.configuration.configured, missing: client.configuration.missing });
if (!client.configuration.configured) process.exit(0);

try {
  await client.login();
  result({ stage: 'authentication', state: 'AUTHENTICATED' });
} catch (error) {
  result({ stage: 'authentication', ...safeError(error) });
  process.exit(0);
}

for (const symbol of requested) {
  try {
    const quote = await client.getQuote(symbol);
    result({ symbol, capability: 'quote', state: quote.status, sourceTimestampKnown: Boolean(quote.observedAt) });
  } catch (error) {
    result({ symbol, capability: 'quote', ...safeError(error) });
  }
  try {
    const series = await client.getDailyCandles(symbol);
    const assessment = assessDailySeries(series);
    result({ symbol, capability: 'daily-bars', state: series.status, bars: series.bars.length, rejected: series.diagnostics.rejected,
      latestDay: assessment.latestDay, ageDays: assessment.ageDays, freshness: assessment.freshness });
  } catch (error) {
    result({ symbol, capability: 'daily-bars', ...safeError(error) });
  }
}
