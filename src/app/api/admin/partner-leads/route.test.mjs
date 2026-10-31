import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from './route.js';

test('admin partner-leads GET denies unauthorized users', async () => {
  const req = new Request('http://localhost:3000/api/admin/partner-leads');
  const res = await GET(req);
  assert.equal(res.status, 403);
});

test('admin partner-leads POST denies unauthorized users', async () => {
  const req = new Request('http://localhost:3000/api/admin/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ id: 'lead_123', status: 'contacted' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 403);
});
