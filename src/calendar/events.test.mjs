import test from 'node:test';
import assert from 'node:assert/strict';
import {MACRO_EVENTS,filterMacroEvents,CALENDAR_STATUS} from './events.mjs';
test('an unconfigured calendar never publishes invented forecasts or event dates',()=>{
 assert.equal(CALENDAR_STATUS,'unconfigured');assert.deepEqual(MACRO_EVENTS,[]);assert.deepEqual(filterMacroEvents(),[]);
});
test('filters verified events by both impact and market',()=>{
 const events=[{id:'one',impact:'high',affectedMarkets:['thai']},{id:'two',impact:'low',affectedMarkets:['us']}];
 assert.deepEqual(filterMacroEvents({impact:'high',market:'thai'},events).map(e=>e.id),['one']);
 assert.deepEqual(filterMacroEvents({impact:'low',market:'thai'},events),[]);
});
