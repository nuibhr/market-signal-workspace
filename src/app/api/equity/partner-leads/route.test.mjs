import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET } from './route.js';

test('partner-leads POST rejects invalid origin', async () => {
  const req = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://malicious-site.com' },
    body: JSON.stringify({ brokerId: '003', fullName: 'สมชาย ใจดี', phone: '0812345678' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 403);
});

test('partner-leads POST validates broker and phone format', async () => {
  // Invalid broker
  const req1 = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ brokerId: '999', fullName: 'สมชาย ใจดี', phone: '0812345678' }),
  });
  const res1 = await POST(req1);
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.equal(data1.error, 'INVALID_BROKER');

  // Invalid phone
  const req2 = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ brokerId: '003', fullName: 'สมชาย ใจดี', phone: '12345' }),
  });
  const res2 = await POST(req2);
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.equal(data2.error, 'INVALID_PHONE');
});

test('partner-leads POST successfully saves lead and does not expose direct external broker links', async () => {
  const req = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      brokerId: '003',
      fullName: 'ทดสอบ เปิดพอร์ตพาย',
      phone: '0891234567',
      lineId: 'test_line',
      email: 'test@example.com',
      interests: ['หุ้นไทย Stage 2', 'DR หุ้นนอก'],
      notes: 'สนใจเทรด DR NVDA80',
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.leadId.startsWith('lead_'));
  assert.equal(data.brokerId, '003');
  assert.equal(data.brokerOpenUrl, undefined);
});

test('partner-leads POST validates existing_port requires accountNo', async () => {
  const req = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      brokerId: '050',
      leadType: 'existing_port',
      fullName: 'นายทดสอบ เอเอสแอล',
      phone: '0812345678',
      // accountNo is missing
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'ACCOUNT_NO_REQUIRED');
});

test('partner-leads POST successfully saves ASL 050 lead with existing_port and accountNo', async () => {
  const req = new Request('http://localhost:3000/api/equity/partner-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      brokerId: '050',
      leadType: 'existing_port',
      accountNo: 'ASL-998877',
      fullName: 'นายสมเกียรติ พอร์ตเอเอสแอล',
      phone: '0898765432',
      lineId: 'somkiat_asl',
      email: 'somkiat@asl.co.th',
      interests: ['หุ้นไทย Stage 2'],
      notes: 'ขอสิทธิ์ VIP ห้องสแกนหุ้น',
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.brokerId, '050');
  assert.equal(data.brokerName, 'ASL Securities (บล.เอเอสแอล)');
  assert.equal(data.leadType, 'existing_port');
  assert.equal(data.accountNo, 'ASL-998877');
});

test('partner-leads GET rejects unauthorized requests', async () => {
  const req = new Request('http://localhost:3000/api/equity/partner-leads');
  const res = await GET(req);
  assert.equal(res.status, 403);
});

