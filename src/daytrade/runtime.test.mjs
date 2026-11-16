import test from 'node:test';
import assert from 'node:assert/strict';
import {daytradeRuntime} from './runtime.mjs';
test('native scanning is independent of enabling CFD pairing but never falls back to SQLite on D1',()=>{
 const env={STORAGE_PROVIDER:'sqlite',FOREX_MT5_ENABLED:'false'};
 assert.equal(daytradeRuntime('thai',env).enabled,true);assert.equal(daytradeRuntime('dr',env).enabled,true);
 assert.equal(daytradeRuntime('us',env).enabled,false);
 for(const market of ['thai','us','forex']){
  const cloud=daytradeRuntime(market,{STORAGE_PROVIDER:'d1',FOREX_MT5_ENABLED:'true'});
  assert.equal(cloud.enabled,false);assert.equal(cloud.disabledReason,'NODE_RECEIVER_REQUIRED');
 }
 assert.equal(daytradeRuntime('thai',{FOREX_MT5_DATABASE_PATH:'same.sqlite',DATABASE_PATH:'same.sqlite'}).enabled,false);
 assert.equal(daytradeRuntime('forex',{NODE_ENV:'production',STORAGE_PROVIDER:'d1-http',FOREX_MT5_ENABLED:'true',FOREX_MT5_PERSISTENT_STORAGE:'true',FOREX_MT5_DATABASE_PATH:'/var/lib/nugaom/forex/bridge.sqlite'}).enabled,true);
 assert.equal(daytradeRuntime('forex',{STORAGE_PROVIDER:'d1-http',FOREX_MT5_ENABLED:'true'}).enabled,false,'Remote membership storage does not imply persistent private broker storage');
});
