// User-supplied research specification. This is not enabled in the legacy ORB
// scanner: entry rules and the three-year data/cost coverage must be verified first.
export const SWING_RESEARCH_SPEC = Object.freeze({
  version: 'swing-research-v1', status: 'research-only', holdingStyle: 'multi-day',
  contextFrame: '1d', structureFrame: '4h', atrPeriod: 14, maxStopPercent: 8,
  minimumNetRewardRisk: 2, riskFractions: [0.005, 0.01],
  entryVariants: ['breakout', 'pullback'],
  acceptance: { expectancyNetRAbove: 0, minimumProfitFactor: 1.5, minimumMeanClosedNetR: 2, maximumDrawdownPercent: null },
  requestedFrom: '2023-10-15', requestedToExclusive: '2026-10-15',
  standard: { stopATR: 1, scaleOut: [{ atNetR: 2, fraction: 0.5 }], runnerFraction: 0.5,
    breakEven: 'after-tp1-including-costs', trail: 'confirmed-support-minus-ATR' },
  advanced: { stopATR: { thai: 1, dr: 1.5, us: 1.5 },
    scaleOut: [{ atNetR: 1, fraction: 1 / 3 }, { atNetR: 2, fraction: 1 / 3 }], runnerFraction: 1 / 3,
    trendRewardRisk: 3, trailVariants: ['ema20', 'chandelier-3atr'],
    filters: ['completed-weekly-trend', 'market-regime', 'earnings-calendar'] },
  pending: ['three-year-d1-and-4h-history-plus-warmup', 'execution-history-for-delay',
    'us-user-costs-and-fx', 'tfex-contract-cost-model-and-rollover', 'corporate-actions-and-calendar', 'maximum-drawdown-threshold'],
});

export function thaiResearchCosts(size = 'large') {
  if (!['large', 'small'].includes(size)) throw Error('INVALID_LIQUIDITY_CLASS');
  // Assumptions supplied by the user, not a broker tariff/tax certification.
  return { label: `user-thai-${size}-commission-revised`, commissionPercent: 0.06, marketFeePercent: 0.005,
    commissionVatPercent: 7, slippagePercent: size === 'large' ? 0.15 : 0.4 };
}
export function drResearchCosts(scenario = 'lower') {
  if (!['lower', 'stress'].includes(scenario)) throw Error('INVALID_SLIPPAGE_SCENARIO');
  return { ...thaiResearchCosts('large'), label: `user-dr-${scenario}-slippage`, slippagePercent: scenario === 'lower' ? 0.3 : 0.5 };
}
export const TFEX_USER_COMMISSIONS = Object.freeze({
  S50: { perContractPerSideTHB: 16, vatPercent: 7 },
  GO: { perContractPerSideTHB: 50, vatPercent: 7 },
  MGO: { perContractPerSideTHB: 5, vatPercent: 7 },
});
export function tfexCommissionComponent(root) {
  const config = TFEX_USER_COMMISSIONS[root];
  if (!config) throw Error('CONTRACT_COMMISSION_REQUIRED');
  return { ...config, commissionWithVatPerSideTHB: config.perContractPerSideTHB * (1 + config.vatPercent / 100),
    commissionWithVatRoundTripTHB: config.perContractPerSideTHB * (1 + config.vatPercent / 100) * 2,
    excludes: ['exchange-and-licensing-fees-unless-broker-confirms-included', 'spread', 'slippage', 'rollover'] };
}
export function resolveSwingCosts(costs) {
  if (!costs || !['commissionPercent', 'marketFeePercent', 'commissionVatPercent', 'slippagePercent']
    .every(key => typeof costs[key] === 'number' && Number.isFinite(costs[key]) && costs[key] >= 0)) throw Error('COSTS_REQUIRED');
  const fee = (costs.commissionPercent * (1 + costs.commissionVatPercent / 100) + costs.marketFeePercent) / 100;
  const slip = costs.slippagePercent / 100;
  if (fee >= 0.1 || slip >= 0.1) throw Error('INVALID_COSTS');
  return { fee, slip, approximateRoundTripPercent: (fee + slip) * 200, assumptions: { ...costs } };
}
const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const round = (value, tick, up) => Number(((up ? Math.ceil : Math.floor)(value / tick + (up ? -1e-10 : 1e-10)) * tick).toFixed(10));
const rejected = code => ({ version: SWING_RESEARCH_SPEC.version, status: 'blocked', researchEligible: false, tradeAllowed: false, liveEligible: false, code });

export function buildSwingResearchPlan({ entry, swingLow, atr, tickSize, market = 'thai', profile = 'standard', strongTrend = false,
  nearestResistance = null, costs, dataAvailableAt = null }) {
  if (![entry, swingLow, atr, tickSize].every(finitePositive)) return rejected('STRUCTURE_ATR_ENTRY_REQUIRED');
  if (!['standard', 'advanced-ema20', 'advanced-chandelier'].includes(profile)) return rejected('INVALID_PROFILE');
  let friction;
  try { friction = resolveSwingCosts(costs); } catch (error) { return rejected(error.message); }
  if (!['thai', 'dr', 'us', 'tfex'].includes(market)) return rejected('INVALID_MARKET');
  if (market === 'tfex') return rejected('TFEX_CONTRACT_COST_MODEL_REQUIRED');
  const advanced = profile !== 'standard';
  const multiplier = advanced ? SWING_RESEARCH_SPEC.advanced.stopATR[market] : 1;
  const stopLoss = round(swingLow - multiplier * atr, tickSize, false);
  const entryFill = entry * (1 + friction.slip), entryBasis = entryFill * (1 + friction.fee);
  const exitFactor = (1 - friction.slip) * (1 - friction.fee);
  if (!(stopLoss > 0 && stopLoss < entryFill)) return rejected('INVALID_STRUCTURAL_STOP');
  const stopPercent = (entryFill - stopLoss) / entryFill * 100;
  if (stopPercent > 8) return rejected('STRUCTURAL_STOP_EXCEEDS_8_PERCENT');
  const netRiskPerUnit = entryBasis - stopLoss * exitFactor;
  const priceAtNetR = multiple => round((entryBasis + multiple * netRiskPerUnit) / exitFactor, tickSize, true);
  const requiredR = advanced && strongTrend ? 3 : 2;
  const minimumTarget = priceAtNetR(requiredR);
  if (nearestResistance !== null && (!finitePositive(nearestResistance) || nearestResistance < minimumTarget))
    return rejected('RESISTANCE_BEFORE_MINIMUM_NET_REWARD');
  const targets = advanced ? [{ price: priceAtNetR(1), netR: 1, fraction: 1 / 3 }, { price: priceAtNetR(2), netR: 2, fraction: 1 / 3 }]
    : [{ price: minimumTarget, netR: 2, fraction: 0.5 }];
  return { version: SWING_RESEARCH_SPEC.version, status: 'research-candidate', researchEligible: true, tradeAllowed: false, liveEligible: false,
    side: 'LONG', profile, entry, estimatedEntryFill: entryFill, entryBasis, stopLoss, stopPercent,
    atrMultiplier: multiplier, netRiskPerUnit, minimumNetRewardRisk: requiredR, minimumTarget,
    targets, runnerFraction: advanced ? 1 / 3 : 0.5, breakEvenStop: priceAtNetR(0),
    trail: advanced ? profile === 'advanced-ema20' ? 'ema20' : 'chandelier-3atr' : 'confirmed-support-minus-ATR',
    friction, dataAvailableAt, assumptions: ['LONG equities only', 'no fixed/minimum broker fee', 'no dividends/FX without supplied events',
      'R includes the assumed entry/exit fee and slippage at the initial structural stop', 'tick size supplied by instrument metadata'] };
}

export function netRForExit(plan, rawExitPrice) {
  if (!plan?.researchEligible || !finitePositive(rawExitPrice)) throw Error('VALID_RESEARCH_PLAN_REQUIRED');
  return (rawExitPrice * (1 - plan.friction.slip) * (1 - plan.friction.fee) - plan.entryBasis) / plan.netRiskPerUnit;
}

// Partial exits use fractions of the original position. They must not be
// reported as separate winning trades or as a full-position 2R outcome.
export function researchOutcome(plan, fills) {
  if (!Array.isArray(fills) || !fills.length || fills.some(fill => !finitePositive(fill.price) || !finitePositive(fill.fraction)) ||
      fills.reduce((sum, fill) => sum + fill.fraction, 0) > 1 + 1e-9) throw Error('INVALID_EXIT_FRACTIONS');
  const closedFraction = fills.reduce((sum, fill) => sum + fill.fraction, 0);
  return { closedFraction, remainingFraction: Math.max(0, 1 - closedFraction),
    netR: fills.reduce((sum, fill) => sum + fill.fraction * netRForExit(plan, fill.price), 0),
    complete: Math.abs(closedFraction - 1) < 1e-9 };
}
