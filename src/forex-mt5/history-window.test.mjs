import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFloor} from './history-window.mjs';
const config={historyPolicy:'vantage-season-window-v1'};
function sample(iso,offset=180){const now=Date.parse(iso);return {now,clock:{status:'ready',offset_minutes:offset,last_at:now,history_since:now/1000-20}};}
test('bounded bootstrap requires explicit broker policy and independently verified fresh clock',()=>{
  const {now,clock}=sample('2026-10-16T02:00:00Z');
  assert.equal(historyFloor(clock,{},now),clock.history_since);
  assert.equal(historyFloor({...clock,status:'observing'},config,now),clock.history_since);
  assert.equal(historyFloor({...clock,last_at:now-31000},config,now),clock.history_since);
  assert.equal(historyFloor({...clock,offset_minutes:120},config,now),clock.history_since);
  assert.equal(historyFloor(clock,config,now),now/1000-7*86400);
});
test('historical bootstrap never crosses either seasonal boundary or extrapolates during US/EU disagreement',()=>{
  const fall=sample('2026-10-28T12:00:00Z');
  assert.equal(historyFloor(fall.clock,config,fall.now),fall.clock.history_since);
  const winter=sample('2026-11-03T12:00:00Z',120);
  assert.ok(historyFloor(winter.clock,config,winter.now)>=Date.parse('2026-11-01T06:00:00Z')/1000);
  const summer=sample('2026-04-01T12:00:00Z');
  assert.ok(historyFloor(summer.clock,config,summer.now)>=Date.parse('2026-03-29T01:00:00Z')/1000);
});
