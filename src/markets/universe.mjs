const MARKET_CONFIG = Object.freeze({
  SET100: { name: 'SET100', rule: 'official-index-constituents', venue: 'SET' },
  MAI50: { name: 'mai Top 50 by Market Cap', rule: 'top-50-market-cap', venue: 'mai' },
  DR80: { name: 'DR ending in 80', rule: 'symbol-suffix-80', venue: 'SET' },
  TFEX: { name: 'TFEX futures', rule: 'configured-contracts', venue: 'TFEX' },
  INTERNATIONAL: { name: 'International equities', rule: 'user-selected', venue: null },
  FOREX: { name: 'Forex pairs', rule: 'configured-currency-pairs', venue: 'TWELVE_DATA_COMPOSITE' },
  CRYPTO_SPOT: { name: 'Crypto spot pairs', rule: 'configured-spot-pairs', venue: 'BINANCE' },
});

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeInstrument(instrument, market) {
  if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument)) return null;
  const symbol = typeof instrument.symbol === 'string' ? instrument.symbol.trim().toUpperCase() : '';
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(symbol)) return null;
  return {
    instrumentId: instrument.instrumentId ?? `${market}:${symbol}`,
    symbol,
    market,
    venue: instrument.venue ?? MARKET_CONFIG[market].venue,
    productType: instrument.productType ?? 'equity',
    currency: instrument.currency ?? null,
    baseAsset: instrument.baseAsset ?? null,
    quoteAsset: instrument.quoteAsset ?? null,
    group: instrument.group ?? null,
    expiry: instrument.expiry ?? null,
    status: instrument.status ?? 'unknown',
    source: instrument.source ?? null,
    marketCap: Number.isFinite(instrument.marketCap) && instrument.marketCap >= 0 ? instrument.marketCap : null,
    marketCapRank: Number.isInteger(instrument.marketCapRank) ? instrument.marketCapRank : null,
    rankAsOf: instrument.rankAsOf ?? null,
    effectiveFrom: instrument.effectiveFrom ?? null,
    effectiveTo: instrument.effectiveTo ?? null,
  };
}

function makeSnapshot(market, rows, { source, asOf, effectiveFrom, effectiveTo, expectedCount = null } = {}) {
  if (!MARKET_CONFIG[market]) throw new TypeError('UNKNOWN_MARKET');
  if (!source || !validDate(asOf)) throw new TypeError('SNAPSHOT_SOURCE_AND_AS_OF_REQUIRED');
  if (effectiveFrom && !validDate(effectiveFrom)) throw new TypeError('INVALID_EFFECTIVE_FROM');
  if (effectiveTo && !validDate(effectiveTo)) throw new TypeError('INVALID_EFFECTIVE_TO');

  const seen = new Set();
  const instruments = [];
  for (const row of rows) {
    const instrument = normalizeInstrument(row, market);
    if (!instrument || seen.has(instrument.symbol)) continue;
    seen.add(instrument.symbol);
    instruments.push({ ...instrument, source, effectiveFrom, effectiveTo });
  }
  if (market === 'SET100' && instruments.length !== 100) {
    throw new TypeError('SET100_REQUIRES_100_VALID_CONSTITUENTS');
  }
  return {
    market,
    name: MARKET_CONFIG[market].name,
    rule: MARKET_CONFIG[market].rule,
    source,
    asOf,
    effectiveFrom,
    effectiveTo,
    expectedCount,
    actualCount: instruments.length,
    complete: expectedCount === null ? null : instruments.length === expectedCount,
    instruments,
  };
}

/** Make a dated snapshot from the official constituents of the active SET100 period. */
export function createSet100Snapshot(instruments, metadata) {
  if (!metadata?.effectiveFrom || !validDate(metadata.effectiveFrom)) throw new TypeError('SET100_EFFECTIVE_FROM_REQUIRED');
  return makeSnapshot('SET100', instruments, { ...metadata, expectedCount: 100 });
}

/** Rank only active mai listings with market cap data from the same dated source snapshot. */
export function createMaiTop50Snapshot(securities, { source, asOf, limit = 50 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('INVALID_LIMIT');
  const ranked = securities
    .filter(row => row?.market === 'mai' && row?.status === 'TRADING'
      && typeof row.symbol === 'string' && Number.isFinite(row.marketCap) && row.marketCap >= 0)
    .sort((a, b) => b.marketCap - a.marketCap || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map((row, index) => ({ ...row, marketCapRank: index + 1, rankAsOf: asOf }));
  return makeSnapshot('MAI50', ranked, { source, asOf, expectedCount: limit });
}

/** DR80 is an exact suffix rule; variants such as 80X are intentionally excluded. */
export function createDr80Snapshot(securities, { source, asOf, effectiveFrom, effectiveTo } = {}) {
  const dr80 = securities.filter(row => typeof row?.symbol === 'string' && /80$/.test(row.symbol.trim()));
  return makeSnapshot('DR80', dr80, { source, asOf, effectiveFrom, effectiveTo });
}

/** Preserve contract expiry and keep every TFEX expiry as an individual instrument. */
export function createTfexSnapshot(contracts, metadata) {
  const rows = contracts.map(contract => ({ ...contract, productType: contract.productType ?? 'future' }));
  return makeSnapshot('TFEX', rows, metadata);
}

/** Convert configured symbols against the exchange's current spot trading catalogue. */
export function createCryptoSpotSnapshot(exchangeSymbols, configuredSymbols, { source = 'Binance Spot', asOf } = {}) {
  if (!validDate(asOf)) throw new TypeError('SNAPSHOT_AS_OF_REQUIRED');
  const bySymbol = new Map(exchangeSymbols.map(row => [row.symbol, row]));
  const rows = configuredSymbols.map(symbol => {
    const listed = bySymbol.get(symbol);
    return listed && ['TRADING', 'available'].includes(listed.status) && listed.isSpotTradingAllowed !== false
      ? { symbol, productType: 'spot', baseAsset: listed.baseAsset, quoteAsset: listed.quoteAsset, status: 'TRADING' }
      : { symbol, productType: 'spot', status: 'unavailable' };
  });
  return makeSnapshot('CRYPTO_SPOT', rows, { source, asOf, expectedCount: configuredSymbols.length });
}

/** Keep FX symbols, base/quote currencies and provider group explicit in dated snapshots. */
export function createForexSnapshot(providerPairs, configuredSymbols, { source = 'Twelve Data Forex Composite', asOf } = {}) {
  if (!validDate(asOf)) throw new TypeError('SNAPSHOT_AS_OF_REQUIRED');
  const bySymbol = new Map(providerPairs.map(row => [String(row?.symbol ?? '').toUpperCase(), row]));
  const rows = configuredSymbols.map(symbol => {
    const normalized = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
    const listed = bySymbol.get(normalized);
    const match = /^([A-Z]{3})\/([A-Z]{3})$/.exec(normalized);
    if (!match) return { symbol: normalized, productType: 'spot-fx-reference', status: 'unavailable' };
    return listed
      ? {
          symbol: normalized,
          baseAsset: listed.baseAsset ?? match[1],
          quoteAsset: listed.quoteAsset ?? match[2],
          group: listed.group ?? null,
          productType: 'spot-fx-reference',
          status: 'available',
        }
      : { symbol: normalized, baseAsset: match[1], quoteAsset: match[2], productType: 'spot-fx-reference', status: 'unavailable' };
  });
  return makeSnapshot('FOREX', rows, { source, asOf, expectedCount: configuredSymbols.length });
}

export const MARKET_UNIVERSE_CONFIG = MARKET_CONFIG;
