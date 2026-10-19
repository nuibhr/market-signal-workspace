import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { upsertDemoMember, createSession, sessionMember, accountSummary } from './store.mjs';
import { membershipFor } from './rights.mjs';

const temporary = mkdtempSync(join(tmpdir(), 'nugaom-demo-auth-'));
process.env.DATABASE_PATH = join(temporary, 'fixture.sqlite');
process.env.SESSION_SECRET = 'fixture-session-secret-key-at-least-32-chars-long';
process.env.PORTFOLIO_HASH_SECRET = 'fixture-portfolio-secret-key-at-least-32-chars-long';

const { sharedDatabase } = await import('../storage/sqlite.mjs');
test.after(() => {
  try { sharedDatabase().close(); } catch {}
  rmSync(temporary, { recursive: true, force: true });
});

test('upsertDemoMember creates a valid 14-day trial member with active scanner rights', async () => {
  const demoTrial = await upsertDemoMember({ role: 'trial' });
  assert.equal(demoTrial.id, 'demo-trial-member');
  assert.equal(demoTrial.portfolio_status, 'verified');
  assert.equal(demoTrial.broker, 'KASIKORN SECURITIES');
  assert.equal(demoTrial.portfolio_last4, '8899');
  assert.ok(Date.parse(demoTrial.trial_ends_at) > Date.now());

  const rights = membershipFor(demoTrial);
  assert.equal(rights.tier, 'trial');
  assert.equal(rights.authenticated, true);
  assert.equal(rights.capabilities.manualDailyScan, true);
  assert.equal(rights.capabilities.autoPickFeed, true);
  assert.equal(rights.capabilities.aiQuestions, true);
  assert.equal(rights.limits.dailyScanSymbols, 8);
  assert.equal(rights.limits.freeAiQuestionsDaily, 5);

  const session = await createSession(demoTrial.id);
  assert.ok(session.value);
  assert.ok(session.expiresAt);

  const retrieved = await sessionMember(session.value);
  assert.equal(retrieved?.id, demoTrial.id);
  assert.equal(retrieved?.display_name, demoTrial.display_name);

  const summary = await accountSummary(retrieved);
  assert.equal(summary?.portfolioStatus, 'verified');
  assert.equal(summary?.portfolioLast4, '8899');
});

test('upsertDemoMember creates a subscriber member with monthly subscription access', async () => {
  const demoSubscriber = await upsertDemoMember({ role: 'subscriber' });
  assert.equal(demoSubscriber.id, 'demo-subscriber-member');
  assert.equal(demoSubscriber.portfolio_status, 'verified');
  assert.equal(demoSubscriber.broker, 'INNOVESTX');
  assert.ok(Date.parse(demoSubscriber.subscription_ends_at) > Date.now());

  const rights = membershipFor(demoSubscriber);
  assert.equal(rights.tier, 'subscriber');
  assert.equal(rights.authenticated, true);
  assert.equal(rights.capabilities.manualDailyScan, true);
});
