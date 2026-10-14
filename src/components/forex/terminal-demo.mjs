// Presentation-only fixtures. Never broker data, never input to Auto Pick or execution.
export const DEMO_AS_OF = "2024-10-28T12:00:00Z";
const PRICES = {
  EURUSD: 1.0834,
  GBPUSD: 1.2721,
  USDJPY: 151.24,
  AUDUSD: 0.6571,
  USDCHF: 0.8662,
  USDCAD: 1.3862,
  NZDUSD: 0.598,
  EURGBP: 0.8517,
  EURJPY: 163.85,
  GBPJPY: 192.41,
  EURCHF: 0.9384,
  AUDJPY: 99.38,
  CADJPY: 109.1,
  NZDJPY: 90.44,
  EURAUD: 1.6488,
  GBPAUD: 1.936,
  EURCAD: 1.5018,
  XAUUSD: 2651.2,
  XAGUSD: 33.71,
};
const FEATURED_SETUPS = {
  XAUUSD: { score: 89, signal: "LONG", setup: "Breakout" },
  EURUSD: { score: 78, signal: "BUY", setup: "Pullback" },
  GBPUSD: { score: 82, signal: "SHORT", setup: "Reversal" },
  USDJPY: { score: 65, signal: "WATCH", setup: "Sideway" },
  XAGUSD: { score: 77, signal: "LONG", setup: "Momentum" },
};
export function demoQuote(instrument) {
  const symbol = instrument.canonical_symbol;
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    source: "demo",
    as_of: DEMO_AS_OF,
    price: PRICES[symbol],
    change: ((seed % 12) - 4) / 100,
    score: 65 + (seed % 25),
    signal: ["LONG", "BUY", "WATCH", "SHORT"][seed % 4],
    setup: ["Breakout", "Pullback", "Momentum", "Reversal"][seed % 4],
    ...FEATURED_SETUPS[symbol],
  };
}
export function demoBars(instrument, timeframe = "1h") {
  const price = demoQuote(instrument).price;
  const period =
    { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 }[timeframe] ?? 3600;
  const end = Date.parse(DEMO_AS_OF) / 1000;
  const amplitude = price * 0.0014;
  const raw = Array.from(
    { length: 100 },
    (_, index) =>
      price +
      amplitude *
        (Math.sin(index * 0.33) * 2.3 + Math.cos(index * 0.73) + index * 0.085),
  );
  const offset = raw.at(-1) - price;
  return raw.map((value, index) => {
    const close = value - offset;
    const open =
      raw[Math.max(0, index - 1)] -
      offset +
      Math.sin(index * 1.7) * amplitude * 0.35;
    return {
      time: end - (99 - index) * period,
      open,
      close,
      high:
        Math.max(open, close) + amplitude * (0.3 + Math.abs(Math.sin(index))),
      low:
        Math.min(open, close) - amplitude * (0.3 + Math.abs(Math.cos(index))),
      volume: 0,
    };
  });
}
export function formatDemoPrice(instrument, value) {
  if (!Number.isFinite(value)) return "—";
  const digits =
    instrument.category === "metals"
      ? 2
      : instrument.canonical_symbol.endsWith("JPY")
        ? 3
        : 5;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function ema(values, period) {
  const factor = 2 / (period + 1);
  let previous = values[0];
  return values.map(
    (value) => (previous = value * factor + previous * (1 - factor)),
  );
}
export function demoIndicators(bars) {
  const closes = bars.map((bar) => bar.close);
  if (closes.length < 15) return { rsi: [], macd: [], signal: [] };
  let gains = 0,
    losses = 0;
  const rsi = [];
  for (let index = 1; index < closes.length; index++) {
    const change = closes[index] - closes[index - 1];
    if (index <= 14) {
      gains += Math.max(change, 0) / 14;
      losses += Math.max(-change, 0) / 14;
    } else {
      gains = (gains * 13 + Math.max(change, 0)) / 14;
      losses = (losses * 13 + Math.max(-change, 0)) / 14;
    }
    rsi.push(
      index < 14
        ? 50
        : losses === 0
          ? gains === 0
            ? 50
            : 100
          : 100 - 100 / (1 + gains / losses),
    );
  }
  const fast = ema(closes, 12),
    slow = ema(closes, 26);
  const macd = fast.map((value, index) => value - slow[index]);
  return { rsi, macd, signal: ema(macd, 9) };
}

// Manual planning only. Pip value must be supplied by the user for their contract.
// No broker specs, lot rounding, account data or orders are inferred here.
export function calculateManualRisk({
  balance,
  riskPercent,
  stopPips,
  pipValue,
}) {
  const values = [balance, riskPercent, stopPips, pipValue].map(Number);
  if (
    values.some((value) => !Number.isFinite(value) || value <= 0) ||
    values[1] > 100
  )
    return null;
  const [accountBalance, percent, stop, valuePerPip] = values;
  const riskAmount = accountBalance * (percent / 100);
  const theoreticalLots = riskAmount / (stop * valuePerPip);
  if (
    ![riskAmount, theoreticalLots].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return null;
  return { riskAmount, theoreticalLots };
}
