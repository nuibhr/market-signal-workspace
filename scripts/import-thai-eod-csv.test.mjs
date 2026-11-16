import test from 'node:test';
import assert from 'node:assert/strict';
import { filterThaiEodCsvText, isValidDailyBar } from './import-thai-eod-csv.mjs';

function makeCsvRows(symbol, count, { basePrice = 5, volume = 2_000_000, startDay = '2025-01-02', injectZeroDay = false, splitDropDay = null } = {}) {
  const rows = [];
  let cursor = Date.parse(`${startDay}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    cursor += 86_400_000;
    if (injectZeroDay && i === 5) {
      rows.push(`${day},${symbol},0.0,0.0,0.0,0.0,0.0`);
      continue;
    }
    const price = splitDropDay && i >= splitDropDay ? +(basePrice / 10).toFixed(2) : basePrice;
    rows.push(`${day},${symbol},${price},${+(price * 1.02).toFixed(2)},${+(price * 0.98).toFixed(2)},${price},${volume}`);
  }
  return rows;
}

test('isValidDailyBar rejects zero-price SP bars and inverted OHLC bounds', () => {
  assert.equal(isValidDailyBar({ time: '2026-11-13', open: 0, high: 0, low: 0, close: 0, volume: 0 }), false);
  assert.equal(isValidDailyBar({ time: '2026-11-13', open: 10, high: 9.5, low: 9, close: 10, volume: 100 }), false);
  assert.equal(isValidDailyBar({ time: '2026-11-13', open: 10, high: 10.5, low: 9.8, close: 10.2, volume: 50000 }), true);
});

test('filterThaiEodCsvText keeps >=2 THB & >=5M daily value including funds, drops penny/illiquid stocks, and slices recent bars', async () => {
  const lines = [
    '\uFEFFD_TRADE,N_SECURITY,Z_OPEN,Z_HIGH,Z_LOW,Z_CLOSE,Q_VOLUME',
    ...makeCsvRows('GOODSTOCK', 420, { basePrice: 10, volume: 1_000_000, injectZeroDay: true }), // 10M/day
    ...makeCsvRows('DIF', 300, { basePrice: 8.5, volume: 800_000, startDay: '2025-05-02' }), // fund >= 2 THB, 6.8M/day
    ...makeCsvRows('PENNY', 300, { basePrice: 1.5, volume: 10_000_000 }), // < 2 THB
    ...makeCsvRows('ILLIQUID', 300, { basePrice: 20, volume: 50_000 }), // 1M/day < 5M
    ...makeCsvRows('SPLITOLD', 420, { basePrice: 100, volume: 500_000, splitDropDay: 20 }), // old split outside 350-bar tail
  ];

  const result = await filterThaiEodCsvText(lines.join('\n'), {
    minPrice: 2,
    minAvgDailyValueThb: 5_000_000,
    minBars: 252,
    maxBars: 350,
    includeFunds: true,
  });

  assert.equal(result.skippedZeroOrInvalid, 1);
  assert.deepEqual(result.qualified.map(q => q.symbol), ['DIF', 'GOODSTOCK', 'SPLITOLD']);
  assert.equal(result.qualified.find(q => q.symbol === 'GOODSTOCK').bars.length, 350);
  assert.equal(result.qualified.find(q => q.symbol === 'DIF').isFund, true);
  assert.equal(result.anomalies.length, 0);
});
