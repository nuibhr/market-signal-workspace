import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTfexContracts} from './tfex-contracts.mjs';

test('December preferred contracts have a deterministic order including USD',()=>{
  const contracts=buildTfexContracts(Date.parse('2026-10-25T00:00:00Z'));
  assert.deepEqual(contracts.slice(0,4).map(c=>c.symbol),['S50Z26','GOZ26','SVFZ26','USDZ26']);
  assert.equal(new Set(contracts.map(c=>c.symbol)).size,contracts.length);
});
