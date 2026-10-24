import test from 'node:test';import assert from 'node:assert/strict';import {readBrokerPortfolio,normalizeBrokerPortfolio} from './broker-portfolio.mjs';
test('credentials without an account never fabricate a LIVE portfolio',async()=>{
 let calls=0;await assert.rejects(readBrokerPortfolio('TFEX',{brokerId:'022',appId:'invalid',appSecret:'invalid',appCode:'invalid'},{fetcher:async()=>{calls++;}}),/ACCOUNT_AND_CREDENTIALS_REQUIRED/);assert.equal(calls,0);
});
test('unsupported broker payload is unavailable rather than a successful empty account',()=>{
 assert.throws(()=>normalizeBrokerPortfolio('SET',{},[]),/ACCOUNT_EQUITY_UNAVAILABLE/);
 assert.throws(()=>normalizeBrokerPortfolio('TFEX',{equity:100},{}),/PORTFOLIO_SCHEMA_UNSUPPORTED/);
});
test('normalization preserves both sides and all series returned by a real broker',()=>{
 const r=normalizeBrokerPortfolio('TFEX',{equity:120000,cashBalance:100000,initialMargin:20000},[{symbol:'S50Z26',actualLongPosition:2,actualShortPosition:1,longAveragePrice:1000,shortAveragePrice:1010},{symbol:'S50H27',actualLongPosition:3,actualShortPosition:0,longAveragePrice:1002}]);
 assert.equal(r.positions.length,3);assert.equal(r.positions[2].symbol,'S50H27');assert.equal(r.totalIm,20000);assert.equal(r.equity,120000);
});
test('empty, authenticated equity accounts are valid but missing financial fields remain unknown',()=>{
 const r=normalizeBrokerPortfolio('SET',{equity:0,cashBalance:0},[]);assert.equal(r.holdings.length,0);assert.equal(r.equity,0);assert.equal(r.health.score,null);
});

test('missing holding market values remain unknown in allocation rather than becoming zero',()=>{
 const result=normalizeBrokerPortfolio('SET',{equity:1000,cashBalance:0},[{symbol:'PTT',actualVolume:100,averagePrice:20}]);
 assert.equal(result.totalMarketValue,null);assert.equal(result.allocation.thaiStockValue,null);assert.equal(result.allocation.thaiStockPct,null);assert.equal(result.cashBalance,0);
});
