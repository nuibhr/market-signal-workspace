import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwingResearchPlan, thaiResearchCosts, drResearchCosts, resolveSwingCosts, netRForExit, researchOutcome, tfexCommissionComponent } from './swing-standard.mjs';
const input = { entry: 144, swingLow: 140.5, atr: 1, tickSize: 0.25, costs: thaiResearchCosts() };
test('confirmed futures rates are per contract per side, include VAT separately and do not pretend to include all costs', () => {
  for (const [root, amount] of [['S50', 17.12], ['GO', 53.5], ['MGO', 5.35]]) {
    const fees = tfexCommissionComponent(root);
    assert.ok(Math.abs(fees.commissionWithVatPerSideTHB - amount) < 1e-9);
    assert.ok(fees.excludes.includes('slippage'));
  }
});

test('revised 0.06% commission gives 0.4384%/0.9384% approximate roundtrip with the other supplied costs', () => {
  assert.ok(Math.abs(resolveSwingCosts(thaiResearchCosts()).approximateRoundTripPercent - 0.4384) < 1e-9);
  assert.ok(Math.abs(resolveSwingCosts(thaiResearchCosts('small')).approximateRoundTripPercent - 0.9384) < 1e-9);
  assert.ok(Math.abs(resolveSwingCosts(drResearchCosts()).approximateRoundTripPercent - 0.7384) < 1e-9);
  assert.ok(Math.abs(resolveSwingCosts(drResearchCosts('stress')).approximateRoundTripPercent - 1.1384) < 1e-9);
});
test('stop comes from swing low minus ATR and cannot be tightened to manufacture a reward ratio', () => {
  const plan = buildSwingResearchPlan(input);
  assert.equal(plan.stopLoss, 139.5); assert.equal(plan.researchEligible, true);
  assert.equal(buildSwingResearchPlan({ ...input, nearestResistance: 148 }).code, 'RESISTANCE_BEFORE_MINIMUM_NET_REWARD');
  assert.equal(buildSwingResearchPlan({ ...input, nearestResistance: 170 }).stopLoss, 139.5);
  assert.equal(plan.tradeAllowed, false); assert.equal(plan.liveEligible, false);
});
test('8% is a maximum stop width, never a target or permission to move the stop inside structure', () => {
  assert.equal(buildSwingResearchPlan({ ...input, swingLow: 132, atr: 2 }).code, 'STRUCTURAL_STOP_EXCEEDS_8_PERCENT');
  assert.equal(buildSwingResearchPlan({ ...input, costs: undefined }).code, 'COSTS_REQUIRED');
});
test('TP1 is at least 2R after costs and breakeven covers the supplied fee/slippage assumptions', () => {
  const plan = buildSwingResearchPlan(input);
  assert.ok(netRForExit(plan, plan.targets[0].price) >= 2);
  assert.ok(netRForExit(plan, plan.breakEvenStop) >= 0);
  assert.ok(plan.breakEvenStop > input.entry);
  assert.ok(netRForExit(plan, input.entry) < 0, 'raw entry is not cost-covered breakeven');
  assert.ok(Math.abs(netRForExit(plan, plan.stopLoss) + 1) < 1e-9);
});
test('selling half at 2R and half at breakeven is around 1R overall, not a 2R trade', () => {
  const plan = buildSwingResearchPlan({ ...input, tickSize: 0.000001 });
  const result = researchOutcome(plan, [{ price: plan.targets[0].price, fraction: 0.5 }, { price: plan.breakEvenStop, fraction: 0.5 }]);
  assert.equal(result.complete, true); assert.ok(result.netR >= 1 && result.netR < 1.00001);
  assert.equal(researchOutcome(plan, [{ price: plan.targets[0].price, fraction: 0.5 }]).complete, false);
  assert.throws(() => researchOutcome(plan, [{ price: 150, fraction: 0.6 }, { price: 155, fraction: 0.6 }]));
});
test('advanced DR uses 1.5 ATR, preserves separate scale-outs/trail variants, and requires 3R room in a strong trend', () => {
  const plan = buildSwingResearchPlan({ ...input, market: 'dr', profile: 'advanced-chandelier', strongTrend: true });
  assert.equal(plan.stopLoss, 139); assert.equal(plan.atrMultiplier, 1.5); assert.equal(plan.minimumNetRewardRisk, 3);
  assert.deepEqual(plan.targets.map(target => [target.netR, target.fraction]), [[1, 1 / 3], [2, 1 / 3]]);
  assert.equal(plan.trail, 'chandelier-3atr');
  assert.equal(buildSwingResearchPlan({ ...input, market: 'tfex' }).code, 'TFEX_CONTRACT_COST_MODEL_REQUIRED');
});
