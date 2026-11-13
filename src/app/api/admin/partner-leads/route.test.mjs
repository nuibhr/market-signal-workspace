import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from './route.js';
import { getBrokerStaffRole } from '../../../../membership/store.mjs';

test('getBrokerStaffRole correctly classifies Super Admin vs Broker Officers', () => {
  const env = {
    ADMIN_LINE_IDS: 'U_SUPER_123',
    BROKER_003_ADMIN_LINE_IDS: 'U_PI_001',
    BROKER_022_ADMIN_LINE_IDS: 'U_TRINITY_001',
    BROKER_050_ADMIN_LINE_IDS: 'U_ASL_001',
  };

  // Super Admin
  const superRole = getBrokerStaffRole({ line_id: 'U_SUPER_123' }, env);
  assert.equal(superRole.isSuper, true);
  assert.equal(superRole.role, 'super_admin');

  // ASL Broker Admin
  const aslRole = getBrokerStaffRole({ line_id: 'U_ASL_001' }, env);
  assert.equal(aslRole.isSuper, false);
  assert.equal(aslRole.brokerId, '050');
  assert.equal(aslRole.brokerName, 'ASL Securities (บล.เอเอสแอล)');

  // Pi Broker Admin
  const piRole = getBrokerStaffRole({ line_id: 'U_PI_001' }, env);
  assert.equal(piRole.isSuper, false);
  assert.equal(piRole.brokerId, '003');

  // Trinity Broker Admin
  const trinityRole = getBrokerStaffRole({ line_id: 'U_TRINITY_001' }, env);
  assert.equal(trinityRole.isSuper, false);
  assert.equal(trinityRole.brokerId, '022');

  // Random member (not admin)
  const nonAdminRole = getBrokerStaffRole({ line_id: 'U_NORMAL_USER' }, env);
  assert.equal(nonAdminRole, null);
});

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

