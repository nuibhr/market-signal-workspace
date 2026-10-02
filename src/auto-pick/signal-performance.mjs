export const PERFORMANCE_WINDOW = 100;

// Shared by the ledger, summary, and customer rows. Only resolved entries count.
export function recordedOutcome(signal) {
  if (!['TARGET', 'STOP', 'EXIT'].includes(signal.status)
    || !Number.isFinite(signal.entryPrice) || signal.entryPrice <= 0
    || !Number.isFinite(signal.exitPrice) || signal.exitPrice <= 0
    || !Number.isFinite(Date.parse(signal.enteredAt)) || !Number.isFinite(Date.parse(signal.exitedAt))
    || Date.parse(signal.exitedAt) < Date.parse(signal.enteredAt)) return null;
  const direction = signal.plan?.side === 'SHORT' ? -1 : 1;
  const difference = direction * (signal.exitPrice - signal.entryPrice);
  const stop = signal.plan?.stopLoss;
  const risk = Number.isFinite(stop) && stop > 0 ? Math.abs(signal.entryPrice - stop) : 0;
  return { returnPercent: difference / signal.entryPrice * 100, rMultiple: risk > 0 ? difference / risk : null };
}

export function summarizeRecordedTrades(trades) {
  const wins = trades.filter(row => row.returnPercent > 0).length;
  const losses = trades.filter(row => row.returnPercent < 0).length;
  const rValues = trades.filter(row => Number.isFinite(row.rMultiple));
  return {
    basis: 'recorded-signals', windowSize: PERFORMANCE_WINDOW, closed: trades.length,
    wins, losses, flat: trades.length - wins - losses,
    from: trades.at(-1)?.exitedAt ?? null, to: trades[0]?.exitedAt ?? null,
    winRate: trades.length ? wins / trades.length * 100 : null,
    averageReturnPercent: trades.length ? trades.reduce((sum, row) => sum + row.returnPercent, 0) / trades.length : null,
    averageR: rValues.length ? rValues.reduce((sum, row) => sum + row.rMultiple, 0) / rValues.length : null,
  };
}
