import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 's'.repeat(64);

import { POST } from './route.js';
import { sessionMember } from '../../../../membership/store.mjs';
import { SESSION_COOKIE } from '../../../../membership/server.mjs';

test('admin-access POST rejects missing key', async () => {
  const req = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: '' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test('admin-access POST rejects wrong credentials', async () => {
  const req = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: 'wrong_secret_123' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

test('admin-access POST succeeds with Super Admin master key', async () => {
  const req = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: 'nugaom@admin2026' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.role, 'super_admin');

  // Verify Set-Cookie header contains nugaom_session
  const setCookie = res.headers.get('Set-Cookie');
  assert.ok(setCookie.includes(SESSION_COOKIE));
});

test('admin-access POST succeeds with Broker Staff keys for Pi, Trinity, ASL', async () => {
  // Pi (003)
  const piReq = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: 'pi003@staff' }),
  });
  const piRes = await POST(piReq);
  assert.equal(piRes.status, 200);
  const piData = await piRes.json();
  assert.equal(piData.role, 'broker_admin');
  assert.equal(piData.broker.brokerId, '003');

  // Trinity (022)
  const trinityReq = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: 'trinity022@staff' }),
  });
  const trinityRes = await POST(trinityReq);
  assert.equal(trinityRes.status, 200);
  const trinityData = await trinityRes.json();
  assert.equal(trinityData.broker.brokerId, '022');

  // ASL (050)
  const aslReq = new Request('http://localhost:3000/api/auth/admin-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ key: 'asl050@staff' }),
  });
  const aslRes = await POST(aslReq);
  assert.equal(aslRes.status, 200);
  const aslData = await aslRes.json();
  assert.equal(aslData.broker.brokerId, '050');
});
