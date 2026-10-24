// Isolated clock/data fixtures, not evidence of a live feed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {thaiSession,closedThaiChartBars,thaiQuoteMetadata,expectedThaiDailySession,assessThaiDailyFeed} from './thai-feed-meta.mjs';
const at=s=>Date.parse(s+'+07:00');
test('SET calendar handles special holiday, weekend and random auction windows honestly',()=>{
 assert.equal(thaiSession(at('2026-10-16T10:30:00')).closedReason,'EXCHANGE_HOLIDAY');
 assert.equal(thaiSession(at('2026-10-24T10:30:00')).scheduledSession,'CLOSED');
 assert.equal(thaiSession(at('2026-10-22T09:40:00')).scheduledSession,'PRE_OPEN');
 assert.equal(thaiSession(at('2026-10-22T09:57:00')).scheduledSession,'OPENING_AUCTION');
 assert.equal(thaiSession(at('2026-10-22T10:00:00')).scheduledSession,'CONTINUOUS');
 assert.equal(thaiSession(at('2026-10-22T12:35:00')).scheduledSession,'INTERMISSION');
 assert.equal(thaiSession(at('2026-10-22T13:40:00')).scheduledSession,'PRE_OPEN');
 assert.equal(thaiSession(at('2026-10-22T16:32:00')).scheduledSession,'CLOSING_AUCTION');
 assert.equal(thaiSession(at('2027-02-01T10:30:00')).scheduledSession,'UNKNOWN');
});
test('today D1 candle becomes visible after the actual close boundary, never before',()=>{
 const bars=[{time:'2026-10-21'},{time:'2026-10-22'}];
 assert.deepEqual(closedThaiChartBars(bars,'1d',at('2026-10-22T16:59:59')),bars.slice(0,1));
 assert.deepEqual(closedThaiChartBars(bars,'1d',at('2026-10-22T17:00:00')),bars);
 const t=Math.floor(at('2026-10-22T10:00:00')/1000);
 assert.equal(closedThaiChartBars([{time:t}],'15m',at('2026-10-22T10:14:59')).length,0);
 assert.equal(closedThaiChartBars([{time:t}],'15m',at('2026-10-22T10:15:00')).length,1);
});
test('missing provider timestamp or book is unknown, never simulated or treated as real-time',()=>{
 const q=thaiQuoteMetadata({status:'available',price:41.5,bid:null,ask:null,volume:100,marketStatus:'Close',observedAt:null,receivedAt:'2026-10-24T01:00:00Z',latency:'unknown'});
 assert.equal(q.observedDelaySeconds,null);assert.equal(q.bid,null);assert.equal(q.ask,null);assert.equal(q.marketStatus,'Close');
 assert.equal(thaiQuoteMetadata({status:'unavailable'}),null);
});

test('freshness follows actual closed SET sessions, not a seven-day calendar allowance',()=>{
 const weekend=at('2026-10-24T08:00:00');
 assert.equal(expectedThaiDailySession(weekend),'2026-10-22');
 assert.equal(assessThaiDailyFeed({bars:[{time:'2026-10-22'}]},weekend).freshness,'recent');
 assert.equal(assessThaiDailyFeed({bars:[{time:'2026-10-21'}]},weekend).freshness,'stale');
 assert.equal(assessThaiDailyFeed({bars:[{time:'2026-10-21'}]},weekend).signalEligible,false);
 assert.equal(expectedThaiDailySession(at('2026-10-22T16:59:59')),'2026-10-21');
 assert.equal(expectedThaiDailySession(at('2026-10-22T17:00:00')),'2026-10-22');
 assert.equal(assessThaiDailyFeed({bars:[{time:'2027-02-01'}]},at('2027-02-01T18:00:00')).freshness,'unknown');
});
test('DR daily charts retain the conservative completed prior-date boundary for their night session',()=>{
 const bars=[{time:'2026-10-21'},{time:'2026-10-22'}];
 assert.deepEqual(closedThaiChartBars(bars,'1d',at('2026-10-22T20:00:00'),'dr'),bars.slice(0,1));
});
