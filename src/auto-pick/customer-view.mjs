// Explicit allowlists: customer APIs must never send internal strategy gates or debug payloads.
export function customerPlan(plan) {
  if (!plan) return null;
  return Object.fromEntries(['side', 'entry', 'entryZone', 'stopLoss', 'tp1', 'tp2', 'signalTimeframe',
    'signalScore', 'riskReward1', 'tradeAllowed'].filter(key => plan[key] !== undefined).map(key => [key, plan[key]]));
}
export function customerSignal(signal) {
  const row = Object.fromEntries(['id', 'symbol', 'market', 'status', 'sessionDay', 'publishedAt',
    'entryPrice', 'exitPrice', 'enteredAt', 'exitedAt'].map(key => [key, signal[key] ?? null]));
  row.plan = customerPlan(signal.plan);
  if (signal.events) row.events = signal.events.map(customerEvent);
  return row;
}
export function customerEvent(event) {
  return Object.fromEntries(['id', 'type', 'pickId', 'symbol', 'market', 'barTime', 'barDay', 'price',
    'createdAt', 'entryCeiling', 'stopLoss', 'tp1', 'session'].filter(key => event[key] !== undefined).map(key => [key, event[key]]));
}
export function customerFeed(feed) {
  return { signals: feed.signals.map(customerSignal), events: feed.events.map(customerEvent), outcomes: feed.outcomes, marketOutcomes: feed.marketOutcomes??{} };
}
