import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedOutcome, summarizeRecordedTrades } from './signal-performance.mjs';

const entered = { status:'EXIT', entryPrice:100, exitPrice:98, enteredAt:'2026-10-01T03:00:00Z', exitedAt:'2026-10-01T04:00:00Z', plan:{side:'LONG',stopLoss:98} };
test('recorded outcomes use prices and direction, including rule exits and short trades', () => {
  assert.deepEqual(recordedOutcome(entered),{returnPercent:-2,rMultiple:-1});
  assert.deepEqual(recordedOutcome({...entered,plan:{side:'SHORT',stopLoss:102}}),{returnPercent:2,rMultiple:1});
  assert.equal(recordedOutcome({...entered,status:'EXPIRED'}),null);
  assert.equal(recordedOutcome({...entered,status:'REVIEW'}),null);
  assert.equal(recordedOutcome({...entered,enteredAt:null}),null);
  assert.equal(recordedOutcome({...entered,exitedAt:'invalid'}),null);
  assert.equal(recordedOutcome({...entered,exitPrice:0}),null);
  assert.equal(recordedOutcome({...entered,plan:{side:'LONG'}}).rMultiple,null);
});
test('no completed trades means no win rate; flat trades are recorded but never counted as wins', () => {
  assert.equal(summarizeRecordedTrades([]).winRate,null);
  const summary=summarizeRecordedTrades([{...entered,...recordedOutcome(entered)}, {...entered,...recordedOutcome({...entered,exitPrice:100})}]);
  assert.equal(summary.closed,2);assert.equal(summary.losses,1);assert.equal(summary.flat,1);assert.equal(summary.wins,0);
  assert.equal(summary.winRate,0);assert.equal(summary.averageReturnPercent,-1);
});
