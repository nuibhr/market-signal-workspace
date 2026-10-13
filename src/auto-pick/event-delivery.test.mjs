import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNotificationInbox } from './notification-inbox.mjs';
const dir = mkdtempSync(join(tmpdir(), 'nugaom-event-pages-'));
process.env.DATABASE_PATH = join(dir, 'fixtures.sqlite');
process.env.STORAGE_PROVIDER = 'sqlite';
const { createSignal } = await import('./store.mjs');
const { signalEventPage } = await import('./event-pages.mjs');
const { sharedDatabase } = await import('../storage/sqlite.mjs');
test.after(() => { sharedDatabase().close(); rmSync(dir, { recursive: true, force: true }); });
function browser() {
  const values = new Map(); let tail = Promise.resolve();
  return { values, storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    locks: { request: (_key, _options, work) => { const task = tail.then(work); tail = task.catch(() => {}); return task; } } };
}
const event = (id, type = 'ENTRY', createdAt = new Date().toISOString()) => ({ id, type, market: 'us', symbol: 'NVDA', price: 100, createdAt });

test('120 immutable events catch up beyond the latest 50 without losing order or private-plan filtering', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-07T04:00:00Z') });
  const plan = { id: 'fixture', entry: 100, stopLoss: 98, tp1: 104, side: 'LONG', features: { privateFormula: true } };
  await createSignal({ market: 'thai', symbol: 'ANCHOR', sessionDay: '2026-10-07', plan, source: 'FIXTURE ONLY' });
  const initial = await signalEventPage();
  assert.equal(initial.events.length, 0);
  for (let i = 0; i < 120; i++) await createSignal({ market: 'thai', symbol: `TEST${i}`, sessionDay: '2026-10-07', plan, source: 'FIXTURE ONLY' });
  let cursor = initial.nextCursor, ids = [], page;
  do {
    page = await signalEventPage({ after: cursor });
    assert.ok(page.events.length <= 50);
    assert.ok(page.events.every(row => !('planJson' in row) && !('features' in row) && row.tp1 === 104));
    ids.push(...page.events.map(row => row.id)); cursor = page.nextCursor;
  } while (page.hasMore);
  assert.equal(ids.length, 120);
  assert.equal(new Set(ids).size, 120);
  assert.equal((await signalEventPage({ after: cursor })).events.length, 0);
  await assert.rejects(signalEventPage({ after: 'bad-cursor' }), /INVALID_EVENT_CURSOR/);
  await assert.rejects(signalEventPage({ after: 'f'.repeat(32) }), /EVENT_CURSOR_UNAVAILABLE/);
});

test('receiving a page persists pending popups before advancing the cursor; reload resumes them', async () => {
  const shared = browser(), options = { ...shared, scope: 'member-one', owner: 'first-tab' };
  const first = createNotificationInbox(options);
  await first.receive({ events: [event('a'), event('b', 'TARGET')], nextCursor: 'b' }, null);
  const stored = JSON.parse(shared.values.get('nugaom-signal-inbox:member-one'));
  assert.equal(stored.cursor, 'b'); assert.equal(stored.pending.length, 2); assert.equal(stored.pending[0].displayedAt, null);
  const reload = createNotificationInbox({ ...options, owner: 'reloaded-tab' });
  const claimed = await reload.claim();
  assert.equal(claimed.id, 'a');
  await reload.displayed('a'); await reload.voice('a', 'blocked'); await reload.release();
  const retry = createNotificationInbox({ ...options, owner: 'retry-tab' });
  assert.equal((await retry.claim()).deliveryVoice, 'blocked');
  await retry.voice('a', 'ended'); await retry.dismiss('a');
  assert.equal((await retry.claim()).id, 'b');
});

test('visible tabs share a lease, hidden tabs do not consume alerts, and account inboxes stay separate', async () => {
  const shared = browser();
  const one = createNotificationInbox({ ...shared, scope: 'member-one', owner: 'one' });
  const two = createNotificationInbox({ ...shared, scope: 'member-one', owner: 'two' });
  const otherMember = createNotificationInbox({ ...shared, scope: 'member-two', owner: 'other' });
  await one.receive({ events: [event('entry')], nextCursor: 'entry' });
  assert.equal(await one.claim(false), null);
  const claims = await Promise.all([one.claim(), two.claim()]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal((await otherMember.snapshot()).pending, 0);
  assert.equal(await otherMember.claim(), null);
});

test('stale responses cannot move a received cursor backwards or lose a later page', async () => {
  const shared = browser(), inbox = createNotificationInbox({ ...shared, scope: 'member', owner: 'one' });
  assert.equal(await inbox.receive({ events: [event('a')], nextCursor: 'a' }, null), true);
  assert.equal(await inbox.receive({ events: [event('b')], nextCursor: 'b' }, 'a'), true);
  assert.equal(await inbox.receive({ events: [event('a')], nextCursor: 'a' }, null), false);
  assert.equal((await inbox.snapshot()).cursor, 'b');
  assert.equal((await inbox.snapshot()).pending, 2);
});

test('a dead tab lease can recover; old alerts are labelled historical and not eligible for automatic speech', async () => {
  const shared = browser(); let now = Date.now();
  const one = createNotificationInbox({ ...shared, scope: 'member', owner: 'dead-tab', now: () => now });
  await one.receive({ events: [event('entry', 'ENTRY', new Date(now - 1800001).toISOString())], nextCursor: 'entry' });
  assert.equal((await one.claim()).historical, true);
  const two = createNotificationInbox({ ...shared, scope: 'member', owner: 'new-tab', now: () => now });
  assert.equal(await two.claim(), null);
  now += 120001;
  assert.equal((await two.claim()).id, 'entry');
});

test('storage denial is reported and preserves in-memory pending events without claiming durability', async () => {
  let errors = 0;
  const inbox = createNotificationInbox({ scope: 'member', owner: 'one', storage: { getItem() { return null; }, setItem() { throw Error(); } },
    onPersistenceError: () => errors++ });
  await inbox.receive({ events: [event('a')], nextCursor: 'a' });
  assert.equal((await inbox.snapshot()).durable, false);
  assert.equal((await inbox.claim()).id, 'a');
  assert.ok(errors > 0);
});

test('capacity applies backpressure instead of dropping events; entry takes priority over watch announcements', async () => {
  const shared = browser(), inbox = createNotificationInbox({ ...shared, scope: 'member', owner: 'one' });
  const events = Array.from({ length: 499 }, (_, index) => event(`watch-${index}`, 'PICK_READY'));
  events.push(event('entry'));
  assert.equal(await inbox.receive({ events, nextCursor: 'entry' }, null), true);
  assert.equal(await inbox.receive({ events: [event('extra')], nextCursor: 'extra' }, 'entry'), false);
  assert.equal((await inbox.snapshot()).cursor, 'entry');
  assert.equal((await inbox.claim()).id, 'entry');
});
