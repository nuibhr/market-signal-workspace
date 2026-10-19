import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MACRO_EVENTS, filterMacroEvents } from './events.mjs';

describe('Economic Calendar & Macro Events Module', () => {
  it('contains valid events with required fields', () => {
    assert.ok(MACRO_EVENTS.length >= 5);
    for (const evt of MACRO_EVENTS) {
      assert.ok(evt.id);
      assert.ok(evt.title);
      assert.ok(['high', 'medium', 'low'].includes(evt.impact));
      assert.ok(Array.isArray(evt.affectedMarkets));
      assert.ok(evt.aiAnalysis);
      assert.ok(evt.actionPlan);
    }
  });

  it('filters by high impact correctly', () => {
    const highEvents = filterMacroEvents({ impact: 'high' });
    assert.ok(highEvents.length > 0);
    assert.ok(highEvents.every((e) => e.impact === 'high'));
  });

  it('filters by market correctly', () => {
    const thaiEvents = filterMacroEvents({ market: 'thai' });
    assert.ok(thaiEvents.length > 0);
    assert.ok(thaiEvents.every((e) => e.affectedMarkets.includes('thai')));
  });
});
