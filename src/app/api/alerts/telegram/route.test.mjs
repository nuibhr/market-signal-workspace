import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from './route.js';

test('GET /api/alerts/telegram returns provider status', async () => {
  const res = await GET(new Request('http://localhost/api/alerts/telegram'));
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.provider, 'telegram');
  assert.ok(data.cost.includes('FREE'));
});

test('POST /api/alerts/telegram rejects missing credentials', async () => {
  const req = new Request('http://localhost/api/alerts/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: '', chatId: '' })
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
});
