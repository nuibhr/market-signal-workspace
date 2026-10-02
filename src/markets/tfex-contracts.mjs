const MONTH_CODES = Object.freeze(['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z']);
const QUARTER_MONTHS = new Set([2, 5, 8, 11]);
const VERIFIED_LAST_TRADING_DAY = Object.freeze({
  S50U26: '2026-09-29', GOU26: '2026-09-29', SVFU26: '2026-09-29',
  S50Z26: '2026-12-29', GOZ26: '2026-12-29', SVFZ26: '2026-12-29',
});

export const TFEX_PRODUCTS = Object.freeze([
  {
    root: 'S50',
    product: 'SET50 Index Futures',
    priceUnit: 'จุดดัชนี',
    quoteCurrency: 'THB',
    multiplier: 200,
    tickSize: 0.1,
    tickValueTHB: 20,
    schedule: 'near-months-plus-quarters',
  },
  {
    root: 'GO',
    product: 'Gold Online Futures',
    priceUnit: 'USD / troy oz',
    quoteCurrency: 'USD',
    multiplier: 300,
    tickSize: 0.1,
    tickValueTHB: 30,
    schedule: 'quarters',
  },
  {
    root: 'SVF',
    product: 'Silver Online Futures',
    priceUnit: 'USD / troy oz',
    quoteCurrency: 'USD',
    multiplier: 3000,
    tickSize: 0.01,
    tickValueTHB: 30,
    schedule: 'quarters',
  },
]);

function bangkokMonthSerial(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(values.year) * 12 + Number(values.month) - 1;
}

function bangkokDay(value) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(value instanceof Date ? value : new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthParts(serial) {
  const year = Math.floor(serial / 12);
  const month = serial - year * 12;
  return { year, month, code: MONTH_CODES[month], expiryMonth: `${year}-${String(month + 1).padStart(2, '0')}` };
}

function nearestQuarterAtOrAfter(serial) {
  for (let offset = 0; offset < 12; offset += 1) {
    const candidate = serial + offset;
    if (QUARTER_MONTHS.has(candidate % 12)) return candidate;
  }
  return serial;
}

function quarterlySerials(start, count) {
  const result = [];
  let next = nearestQuarterAtOrAfter(start);
  while (result.length < count) {
    result.push(next);
    next = nearestQuarterAtOrAfter(next + 1);
  }
  return result;
}

function productMonths(product, current) {
  if (product.schedule === 'quarters') return quarterlySerials(current, 2);
  const nearMonths = [current, current + 1, current + 2];
  return [...nearMonths, ...quarterlySerials(current + 3, 3)];
}

function createContract(product, serial, rank) {
  const { year, code, expiryMonth } = monthParts(serial);
  const symbol = `${product.root}${code}${String(year).slice(-2)}`;
  const monthLabel = new Date(Date.UTC(year, Number(expiryMonth.slice(-2)) - 1, 1))
    .toLocaleDateString('th-TH', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  return {
    symbol,
    instrumentId: `TFEX:${symbol}`,
    root: product.root,
    product: product.product,
    name: `${product.product} · ${monthLabel}`,
    expiryMonth,
    contractRank: rank,
    priceUnit: product.priceUnit,
    quoteCurrency: product.quoteCurrency,
    multiplier: product.multiplier,
    tickSize: product.tickSize,
    tickValueTHB: product.tickValueTHB,
    productStatus: 'candidate',
  };
}

/**
 * Candidate contract months only. This follows TFEX listed month rules; it does
 * not claim a contract is the active/front contract because the exact last-trading
 * day, holidays, liquidity migration and quote timestamp need source confirmation.
 */
export function buildTfexContracts(now = Date.now()) {
  const current = bangkokMonthSerial(now);
  const today = bangkokDay(now);
  const perProduct = TFEX_PRODUCTS.map(product => productMonths(product, current)
    .map((serial, index) => createContract(product, serial, index + 1)));
  const candidates = [];
  const maxRank = Math.max(...perProduct.map(list => list.length));
  for (let rank = 0; rank < maxRank; rank += 1) {
    for (const contracts of perProduct) if (contracts[rank]) candidates.push(contracts[rank]);
  }
  const available = candidates.filter(contract => !VERIFIED_LAST_TRADING_DAY[contract.symbol]
    || today <= VERIFIED_LAST_TRADING_DAY[contract.symbol]);
  const preferredCode = `Z${String(Math.floor(current / 12)).slice(-2)}`;
  const rootOrder = { S50: 0, GO: 1, SVF: 2 };
  const preferred = available.filter(contract => contract.symbol.endsWith(preferredCode))
    .sort((a, b) => rootOrder[a.root] - rootOrder[b.root]);
  return [...preferred, ...available.filter(contract => !contract.symbol.endsWith(preferredCode))];
}

export const TFEX_CONTRACTS = buildTfexContracts();
export const TFEX_SYMBOLS = TFEX_CONTRACTS.map(contract => contract.symbol);
export const TFEX_CONTRACT_BY_SYMBOL = new Map(TFEX_CONTRACTS.map(contract => [contract.symbol, contract]));
