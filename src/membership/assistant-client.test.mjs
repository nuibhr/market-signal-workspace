import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createAssistantWriter, sendAssistantQuestion } from './assistant-client.mjs';

const temporary = mkdtempSync(join(tmpdir(), 'nugaom-assistant-client-'));
process.env.DATABASE_PATH = join(temporary, 'fixture.sqlite');
process.env.SESSION_SECRET = 'fixture-session-'.repeat(5);
process.env.PORTFOLIO_HASH_SECRET = 'fixture-portfolio-'.repeat(5);
process.env.ADMIN_LINE_IDS = 'U' + 'a'.repeat(32);
const member = await import('./store.mjs');
const { sharedDatabase } = await import('../storage/sqlite.mjs');
test.after(() => { sharedDatabase().close(); rmSync(temporary, { recursive: true, force: true }); });
const input = () => ({ conversationId: randomUUID(), question: 'Fixture research question', selectedSymbol: 'NVDA' });
const answer = { status: 'available', answer: 'Fixture answer', sources: [], chargeType: 'free', quota: { freeRemaining: 4, credits: 0 } };

test('lost committed answer retries the same SQLite credit reservation and charges exactly once', async () => {
  const admin = await member.upsertLineMember({ lineId: process.env.ADMIN_LINE_IDS, displayName: 'Fixture admin' });
  let customer = await member.upsertLineMember({ lineId: 'U' + 'b'.repeat(32), displayName: 'Fixture member' });
  customer = await member.submitPortfolio(customer, 'FIXTURE', '12345678');
  const question = input();
  for (let index = 0; index < 5; index++) {
    const id = randomUUID(), reservation = await member.reserveAiQuestion(customer, id, 'Earlier fixture', question.conversationId);
    await member.completeAiQuestion(customer, id, answer, null, reservation.reservationToken);
  }
  await member.grantAiCredits(admin, customer.id, 2, 'fixture-client-credit-01');
  const bodies = [], started = [], confirmed = [];
  let researches = 0;
  const writer = createAssistantWriter({ onStarted: body => started.push(body), onConfirmed: payload => confirmed.push(payload),
    fetcher: async (_, options) => {
      const body = JSON.parse(options.body); bodies.push(body);
      const reservation = await member.reserveAiQuestion(customer, body.requestId, body.question, body.conversationId);
      if (reservation.kind === 'cached') return Response.json({ ...reservation.response, quota: reservation.quota });
      researches++;
      const payload = { ...answer, chargeType: reservation.chargeType };
      await member.completeAiQuestion(customer, body.requestId, payload, null, reservation.reservationToken);
      throw new TypeError('Fixture response lost after commit');
    } });
  assert.equal((await writer.write(question)).status, 'pending');
  assert.equal((await writer.write(input())).status, 'ignored');
  assert.equal((await member.aiQuota(customer)).credits, 1);
  assert.equal((await writer.retry()).status, 'confirmed');
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(researches, 1); assert.equal(started.length, 1); assert.equal(confirmed.length, 1);
  assert.equal((await member.aiQuota(customer)).credits, 1);
  assert.equal(sharedDatabase().prepare('SELECT COUNT(*) AS n FROM ai_questions WHERE id=?').get(bodies[0].requestId).n, 1);
  assert.equal(writer.snapshot().pending, false);
});

test('synchronous repeated submit, in-progress and rate-limited retries keep one request and one question', async () => {
  let finish;
  const first = new Promise(resolve => { finish = resolve; });
  const bodies = [], started = [], statuses = [first, Response.json({ error: 'RATE_LIMITED' }, { status: 429 }), Response.json(answer)];
  const writer = createAssistantWriter({ onStarted: body => started.push(body), fetcher: async (_, options) => {
    bodies.push(JSON.parse(options.body)); return statuses.shift();
  } });
  const writing = writer.write(input());
  assert.equal((await writer.write(input())).status, 'ignored');
  finish(Response.json({ error: 'QUESTION_IN_PROGRESS' }, { status: 409 }));
  await writing; await writer.retry(); await writer.retry();
  assert.equal(started.length, 1); assert.equal(new Set(bodies.map(body => body.requestId)).size, 1);
  assert.equal(writer.snapshot().pending, false);
});

test('deadline covers fetch and JSON; a later login rejection cannot erase an unknown completed charge', async () => {
  for (const phase of ['fetch', 'body']) {
    const fetcher = async () => phase === 'fetch' ? new Promise(() => {}) : { json: () => new Promise(() => {}) };
    assert.equal((await sendAssistantQuestion(input(), { fetcher, timeoutMs: 10 })).status, 'pending');
  }
  let calls = 0;
  const writer = createAssistantWriter({ fetcher: async () => {
    if (++calls === 1) throw TypeError('Lost response');
    return Response.json({ error: 'LOGIN_REQUIRED' }, { status: 401 });
  } });
  await writer.write(input()); await writer.retry();
  assert.equal(writer.snapshot().pending, true);
  assert.equal((await writer.write(input())).status, 'ignored');
});

test('explicit rejection releases the composer while a server error without quota confirmation remains pending', async () => {
  for (const reply of [Response.json({ error: 'LOGIN_REQUIRED' }, { status: 401 }),
    Response.json({ error: 'BIGDATA_UNGROUNDED', quota: answer.quota }, { status: 503 })]) {
    const writer = createAssistantWriter({ fetcher: async () => reply });
    assert.equal((await writer.write(input())).status, 'rejected');
    assert.equal(writer.snapshot().pending, false);
  }
  for (const reply of [Response.json({ error: 'BIGDATA_UNAVAILABLE' }, { status: 503 }), Response.json({ status: 'available' })]) {
    const writer = createAssistantWriter({ fetcher: async () => reply });
    assert.equal((await writer.write(input())).status, 'pending');
    assert.equal(writer.snapshot().pending, true);
  }
});

test('a definitive daily quota rejection releases a first request and exposes its reset time',async()=>{
 const quota={freeLimit:10,freeRemaining:0,resetAt:'2026-10-21T17:00:00.000Z'};
 const writer=createAssistantWriter({fetcher:async()=>Response.json({error:'AI_QUOTA_EXHAUSTED',quota},{status:429})});
 const outcome=await writer.write({question:'Quota fixture'});
 assert.equal(outcome.status,'rejected');assert.equal(writer.snapshot().pending,false);assert.equal(writer.snapshot().quota.resetAt,quota.resetAt);
});
