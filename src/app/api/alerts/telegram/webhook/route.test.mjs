import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route.js';

function restoreEnv(snapshot) {
  for (const key of ['TELEGRAM_WEBHOOK_SECRET', 'NODE_ENV']) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test('telegram webhook rejects missing or invalid secret token with 401', async () => {
  const snapshot = {
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
  try {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret-123';
    const res = await POST(
      new Request('https://example.com/api/alerts/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'wrong-secret',
        },
        body: JSON.stringify({ update_id: 1 }),
      })
    );
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'UNAUTHORIZED');
  } finally {
    restoreEnv(snapshot);
  }
});

test('telegram webhook fails closed with 503 in production when secret is missing', async () => {
  const snapshot = {
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
  try {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    const res = await POST(
      new Request('https://example.com/api/alerts/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id: 1 }),
      })
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'WEBHOOK_SECRET_NOT_CONFIGURED');
  } finally {
    restoreEnv(snapshot);
  }
});

test('telegram webhook accepts valid secret and ignores non-join-request update', async () => {
  const snapshot = {
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };
  try {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret-123';
    const res = await POST(
      new Request('https://example.com/api/alerts/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'expected-secret-123',
        },
        body: JSON.stringify({ update_id: 2, message: { text: 'hello' } }),
      })
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.handled, false);
  } finally {
    restoreEnv(snapshot);
  }
});

