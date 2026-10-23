import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('ProCopyEaDesk component defines pro copy trade strategies, metrics, and lifecycle stages', () => {
  const content = readFileSync(resolve('src/components/forex/pro-copy-ea-desk.jsx'), 'utf8');
  assert.ok(content.includes('export default function ProCopyEaDesk'));
  assert.ok(content.includes('Gold London/NY Session Trend'));
  assert.ok(content.includes('FX Major Dynamic Envelope'));
  assert.ok(content.includes('Asian Range Liquidity Sweep'));
  assert.ok(content.includes('Win Rate (100 ไม้)'));
  assert.ok(content.includes('Profit Factor'));
  assert.ok(content.includes('Max Drawdown'));
  assert.ok(content.includes('Trade Ledger'));
  assert.ok(content.includes('/api/alerts/telegram'));
});
