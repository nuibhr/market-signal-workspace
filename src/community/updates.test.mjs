import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceIncomingCursor} from './updates.mjs';
test('initial history is silent; new incoming sequence still alerts when unread count falls',()=>{
  const baseline=advanceIncomingCursor(null,20);
  assert.equal(baseline.hasNew,false);
  // A simultaneous receipt can reduce unread from 5 to 1; incoming 21 is still new.
  assert.equal(advanceIncomingCursor(baseline.cursor,21).hasNew,true);
});
test('paging, hiding and own sends do not replay existing incoming announcements',()=>{
  assert.equal(advanceIncomingCursor(21,21).hasNew,false);
  const hidden=advanceIncomingCursor(21,19);assert.equal(hidden.cursor,21);assert.equal(hidden.hasNew,false);
  assert.equal(advanceIncomingCursor(hidden.cursor,21).hasNew,false);
  assert.equal(advanceIncomingCursor(hidden.cursor,22).hasNew,true);
});
