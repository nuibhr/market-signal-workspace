import { readFileSync } from 'node:fs';
import { assessDailySeries, createSettradeClient, createTfexClient, SettradeDataError } from '../src/market-data/settrade.mjs';

const args = process.argv.slice(2);
const marketFlag = args.indexOf('--market');
const market = marketFlag === -1 ? 'SET' : (args[marketFlag + 1] ?? '').toUpperCase();
if (!['SET', 'DR', 'TFEX'].includes(market)) {
  process.stdout.write('{"stage":"configuration","state":"INVALID_MARKET"}\n');
  process.exit(1);
}
if (marketFlag !== -1) args.splice(marketFlag, 2);
const fileFlag = args.indexOf('--credentials-file');
let env = process.env;
if (fileFlag !== -1) {
  const file = args[fileFlag + 1];
  if (!file) {
    process.stdout.write('{"stage":"configuration","state":"CREDENTIAL_FILE_MISSING"}\n');
    process.exit(1);
  }
  try {
    const allowlist = new Set(['SETTRADE_BROKER_ID', 'SETTRADE_APP_CODE', 'BROKER_APP_ID', 'BROKER_API_SECRET', 'SETTRADE_APP_ID', 'SETTRADE_APP_SECRET', 'TFEX_BROKER_ID', 'TFEX_APP_CODE', 'TFEX_APP_ID', 'TFEX_APP_SECRET', 'TFEX_API_SECRET']);
    const selected = {};
    const settradeAppCodes = [];
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match || !allowlist.has(match[1])) continue;
      const value = match[2].trim().replace(/^("|')(.*)\1$/, '$2');
      if (match[1] === 'SETTRADE_APP_CODE') settradeAppCodes.push(value);
      else selected[match[1]] = value;
    }
    // Credential files may contain one app code per market under the repeated
    // generic key. The confirmed file order is equity first, TFEX second.
    if (settradeAppCodes.length) {
      selected.SETTRADE_APP_CODE = market === 'TFEX' ? settradeAppCodes.at(-1) : settradeAppCodes[0];
    }
    env = selected;
  } catch {
    process.stdout.write('{"stage":"configuration","state":"CREDENTIAL_FILE_UNREADABLE"}\n');
    process.exit(1);
  }
  args.splice(fileFlag, 2);
}
const symbols = args;
const requested = symbols.length ? symbols : market === 'TFEX' ? ['S50U26', 'GOU26', 'SVFU26'] : ['PTT', 'AAPL80'];
const client = market === 'TFEX' ? createTfexClient({ env }) : createSettradeClient({ env });

function result(row) {
  process.stdout.write(`${JSON.stringify(row)}\n`);
}

function safeError(error) {
  return error instanceof SettradeDataError
    ? { state: error.code, httpStatus: error.status }
    : { state: 'UNEXPECTED_FAILURE' };
}

result({ stage: 'configuration', market, configured: client.configuration.configured, missing: client.configuration.missing });
if (!client.configuration.configured) process.exit(0);

try {
  await client.login();
  result({ stage: 'authentication', market, state: 'AUTHENTICATED' });
} catch (error) {
  result({ stage: 'authentication', market, ...safeError(error) });
  process.exit(0);
}

for (const symbol of requested) {
  try {
    const quote = await client.getQuote(symbol);
    result({ market, symbol, capability: 'quote', state: quote.status, priceAvailable: quote.price !== null,
      sourceTimestampKnown: Boolean(quote.observedAt), source: quote.source });
  } catch (error) {
    result({ symbol, capability: 'quote', ...safeError(error) });
  }
  if (market === 'TFEX') continue;
  try {
    const series = await client.getDailyCandles(symbol);
    const assessment = assessDailySeries(series);
    result({ symbol, capability: 'daily-bars', state: series.status, bars: series.bars.length, rejected: series.diagnostics.rejected,
      latestDay: assessment.latestDay, ageDays: assessment.ageDays, freshness: assessment.freshness });
  } catch (error) {
    result({ symbol, capability: 'daily-bars', ...safeError(error) });
  }
}
