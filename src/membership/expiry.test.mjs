import test from 'node:test';import assert from 'node:assert/strict';import {extendThirtyDays} from './expiry.mjs';
test('manual VIP retains remaining time and adds exactly thirty days across short months',()=>{
 const start=Date.parse('2027-01-31T00:00:00Z');
 assert.equal(extendThirtyDays(new Date(start).toISOString(),start-1),'2027-03-02T00:00:00.000Z');
 assert.equal(Date.parse(extendThirtyDays(null,start))-start,30*86400000);
});
