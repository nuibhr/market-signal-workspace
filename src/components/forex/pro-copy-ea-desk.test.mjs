import test from 'node:test';import assert from 'node:assert/strict';
import {recordSignal} from '../../notifications/record-signal.mjs';
test('live dispatch retains each actual instrument and its stored prices without substituting a gold preset',()=>{
 for(const [symbol,entry,stop,target] of [['EURUSD',1.09,1.08,1.11],['USDJPY',152,153,150],['XAUUSD',4000,3980,4040]]){
  const record={symbol,side:symbol==='USDJPY'?'SHORT':'LONG',signalTime:123,plan:{entry,stop,target}};
  const signal=recordSignal(record);assert.deepEqual(signal,record);assert.notEqual(signal.plan,record.plan);
 }
});
test('a missing or incomplete live plan cannot be sent as a fabricated sample',()=>{
 assert.throws(()=>recordSignal(null),/CURRENT_SIGNAL_REQUIRED/);
 assert.throws(()=>recordSignal({symbol:'EURUSD',side:'LONG',plan:{entry:1.1}}),/CURRENT_SIGNAL_REQUIRED/);
});
