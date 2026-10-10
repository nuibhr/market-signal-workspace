import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { advanceThaiOrbPick } from './thai-orb.mjs';
import { advanceDrOrbPick } from './dr-orb.mjs';
import { advanceUsEodPick } from './us-engine.mjs';
import { customerFeed } from './customer-view.mjs';
import { claimAnnouncements } from './notification-cursor.mjs';
import { announcementFor, SPOKEN_TYPES } from './announcements.mjs';

// A separate SQLite file and clock: none of these synthetic results enter the customer ledger.
const directory = mkdtempSync(join(tmpdir(), 'nugaom-lifecycle-'));
process.env.STORAGE_PROVIDER = 'sqlite';
process.env.DATABASE_PATH = join(directory, 'signals.sqlite');
const { createSignal, saveAdvance, signalForSession, signalFeed, signalResults, reconcileWatchPlans } = await import('./store.mjs');
const { sharedDatabase } = await import('../storage/sqlite.mjs');
test.after(() => { sharedDatabase().close(); rmSync(directory, { recursive: true, force: true }); });
const at = time => Date.parse(`2026-10-01T${time}:00+07:00`) / 1000;
const candle = (time, values = {}) => ({ time, open: 100, high: 100.1, low: 99.8, close: 100, volume: 10000, ...values });

test('Thai, DR morning/night and US: engine -> persistent ledger -> popup payload -> speech text -> results', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('10:15') * 1000 });
  for (const mode of ['thai', 'dr-day', 'dr-night', 'us']) {
    for (const outcome of ['TARGET', 'STOP']) {
      const market = mode.startsWith('dr') ? 'dr' : mode;
      const night = mode === 'dr-night';
      const openingTime = at(night ? '19:00' : '10:00');
      const confirmTime = at(night ? '20:00' : market === 'dr' ? '10:30' : '10:15');
      const publishedTime = market === 'us' ? Date.parse('2026-09-29T20:15:00Z') / 1000 : confirmTime;
      t.mock.timers.setTime(publishedTime * 1000);
      const symbol = outcome === 'TARGET' ? market === 'us' ? 'NVDA' : market === 'dr' ? 'NVDA80' : 'PTT'
        : market === 'us' ? 'AAPL' : market === 'dr' ? 'AAPL80' : 'AOT';
      const sessionDay = market === 'us' ? '2026-09-29' : market === 'dr' ? `2026-10-01:${night ? 'night' : 'day'}` : '2026-10-01';
      const plan = { id: `${mode}-${outcome}`, side: 'LONG', tradeAllowed: true, entry: 100.1, stopLoss: 98.5, tp1: 104,
        setupType: market === 'dr' ? 'DR_ORB_15M' : 'OPENING_RANGE_BREAKOUT', signalTimeframe: '15m',
        referenceCandles: { fifteenMinuteTimestamp: openingTime }, features: { minEntryBarValue: 100000 } };
      if (market === 'dr') Object.assign(plan.features, { session: night ? 'night' : 'day', openingStart: openingTime,
        openingEnd: confirmTime, entryEnd: at(night ? '23:00' : '11:30'), sessionEnd: night ? at('23:45') : at('12:30'), maxChase: 100.3 });
      if (market === 'us') Object.assign(plan, { timeframe: '1d', signalTimeframe: '1d', trigger: { price: 100.1 },
        referenceCandles: { dailyDay: '2026-09-29' } });
      const pick = await createSignal({ market, symbol, sessionDay, plan, source: 'TEST FIXTURE ONLY' });
      assert.ok(pick);
      assert.equal(await createSignal({ market, symbol, sessionDay, plan, source: 'TEST FIXTURE ONLY' }), null);
      const eventsForPick = async () => customerFeed(await signalFeed()).events.filter(event => event.pickId === pick.id);
      const memory = { seen: null };
      assert.deepEqual(await claimAnnouncements(await eventsForPick(), { memory }), []);
      const opening = Array.from({ length: (confirmTime - openingTime) / 900 }, (_, index) => candle(openingTime + index * 900));
      const confirming = candle(confirmTime, { open: 100.1, high: 100.3, low: 100, close: 100.2 });
      const series = market === 'us' ? [candle('2026-09-29'), { ...confirming, time: '2026-09-30' }] : [...opening, confirming];
      const quote = { marketStatus: night ? 'night' : 'day', price: 100.2 };
      const advance = (row, bars) => market === 'thai' ? advanceThaiOrbPick(row, bars)
        : market === 'dr' ? advanceDrOrbPick(row, bars, quote) : advanceUsEodPick(row, bars);
      t.mock.timers.setTime(market === 'us' ? Date.parse('2026-09-30T20:15:00Z') : (confirmTime + 900) * 1000);
      const entry = advance(pick, series);
      assert.equal(entry.pick.status, 'OPEN');
      assert.equal(entry.pick.entryPrice, 100.2);
      assert.equal(await saveAdvance(entry.pick, entry.events), true);
      assert.equal(await saveAdvance(entry.pick, entry.events), false, 'stale retry cannot duplicate entry');
      const entryAlerts = await claimAnnouncements(await eventsForPick(), { memory });
      assert.deepEqual(entryAlerts.map(event => event.type), ['ENTRY']);
      const message = announcementFor(entryAlerts[0]);
      assert.ok(SPOKEN_TYPES.has(entryAlerts[0].type));
      assert.match(message.text, /100.2/);
      assert.match(message.text, /เป้าหมาย 104/);
      assert.match(message.text, /จุดตัดขาดทุน 98.5/);
      assert.equal(entryAlerts[0].tp1, 104);
      assert.equal(entryAlerts[0].stopLoss, 98.5);
      assert.equal('detail' in entryAlerts[0], false, 'formula/debug detail stays private');
      const exitBar = candle(market === 'us' ? '2026-10-01' : confirmTime + 900, outcome === 'TARGET'
        ? { open: 100.2, high: 104.1, low: 100.1, close: 104 }
        : { open: 97, high: 97.5, low: 96.8, close: 97.2 });
      t.mock.timers.setTime(market === 'us' ? Date.parse('2026-10-01T20:15:00Z') : (confirmTime + 1800) * 1000);
      const current = await signalForSession(market, symbol, sessionDay);
      const exit = advance(current, [...series, exitBar]);
      assert.equal(exit.pick.status, outcome);
      assert.equal(exit.pick.exitPrice, outcome === 'TARGET' ? 104 : 97, 'stop gap uses the opening price, not a better imaginary fill');
      assert.equal(await saveAdvance(exit.pick, exit.events), true);
      assert.equal(await saveAdvance(exit.pick, exit.events), false);
      const exitAlerts = await claimAnnouncements(await eventsForPick(), { memory });
      assert.deepEqual(exitAlerts.map(event => event.type), [outcome]);
      assert.ok(SPOKEN_TYPES.has(exitAlerts[0].type));
      assert.equal(announcementFor(exitAlerts[0]).tone, outcome === 'TARGET' ? 'target' : 'stop');
      assert.deepEqual(await claimAnnouncements(await eventsForPick(), { memory }), []);
      const report = await signalResults({ market, scope: 'closed' });
      const trade = report.signals.find(row => row.id === pick.id);
      assert.ok(trade);
      assert.equal(trade.entryPrice, 100.2);
      assert.equal(trade.exitPrice, exit.pick.exitPrice);
      assert.deepEqual(trade.events.map(event => event.type), ['PICK_READY', 'ENTRY', outcome]);
    }
  }
  const report = await signalResults({ scope: 'closed', pageSize: 10 });
  assert.equal(report.summary.closed, 8);
  assert.equal(report.summary.wins, 4);
  assert.equal(report.summary.losses, 4);
  assert.equal(report.summary.winRate, 50);
});

test('entry and target saved in the same millisecond are delivered in their actual order', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('10:15') * 1000 });
  const opening = candle(at('10:00'));
  const plan = { id: 'same-ms', side: 'LONG', tradeAllowed: true, entry: 100.1, stopLoss: 98.5, tp1: 104,
    setupType: 'OPENING_RANGE_BREAKOUT', referenceCandles: { fifteenMinuteTimestamp: opening.time }, features: { minEntryBarValue: 100000 } };
  const pick = await createSignal({ market: 'thai', symbol: 'SAME_MS', sessionDay: '2026-10-01', plan, source: 'TEST FIXTURE ONLY' });
  const memory = { seen: (await signalFeed()).events.find(event => event.pickId === pick.id).id };
  t.mock.timers.setTime(at('10:45') * 1000);
  const advanced = advanceThaiOrbPick(pick, [opening,
    candle(at('10:15'), { open: 100.1, high: 100.3, low: 100, close: 100.2 }),
    candle(at('10:30'), { open: 100.2, high: 104.1, low: 100.1, close: 104 })]);
  assert.equal(advanced.pick.status, 'TARGET');
  assert.deepEqual(advanced.events.map(event => event.type), ['ENTRY', 'TARGET']);
  await saveAdvance(advanced.pick, advanced.events);
  const events = customerFeed(await signalFeed()).events.filter(event => event.pickId === pick.id);
  assert.equal(events[0].createdAt, events[1].createdAt);
  assert.deepEqual(events.map(event => event.type), ['TARGET', 'ENTRY', 'PICK_READY']);
  assert.deepEqual((await claimAnnouncements(events, { memory })).map(event => event.type), ['ENTRY', 'TARGET']);
});

test('missed session close preserves entries without inventing exits or adding wins/losses', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: at('10:15') * 1000 });
  const before = (await signalResults({ scope: 'closed' })).summary.closed;
  for (const market of ['thai', 'dr']) {
    const plan = { id: `missed-close-${market}`, side: 'LONG', entry: 100, stopLoss: 98, tp1: 104,
      features: { sessionEnd: at('12:30'), entryEnd: at('11:30') } };
    const sessionDay = market === 'dr' ? '2026-10-01:day' : '2026-10-01';
    const pick = await createSignal({ market, symbol: 'MISSED_CLOSE', sessionDay, plan, source: 'TEST FIXTURE ONLY' });
    await saveAdvance({ ...pick, status: 'OPEN', entryPrice: 100, enteredAt: new Date(at('10:30') * 1000).toISOString() },
      [{ type: 'ENTRY', price: 100, barTime: at('10:15') }]);
    await reconcileWatchPlans(['thai', 'dr', 'us'], at('12:40') * 1000);
    assert.equal((await signalForSession(market, pick.symbol, sessionDay)).status, 'OPEN', 'allow the final feed to arrive');
    t.mock.timers.setTime(at('16:00') * 1000);
    await reconcileWatchPlans(['thai', 'dr', 'us']);
    const result = await signalForSession(market, pick.symbol, sessionDay);
    assert.equal(result.status, 'REVIEW');
    assert.equal(result.entryPrice, 100);
    assert.equal(result.exitPrice, null);
    const event = (await signalFeed()).events.find(item => item.pickId === pick.id);
    assert.equal(event.type, 'SESSION_END');
    assert.equal(SPOKEN_TYPES.has(event.type), false);
  }
  assert.equal((await signalResults({ scope: 'closed' })).summary.closed, before);
});
