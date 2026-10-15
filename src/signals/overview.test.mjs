import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSetIndexQuote} from './overview.mjs';
test('SET overview validates the exact index, currency and timestamp; equity proxies or future quotes are refused',()=>{
 const now=Date.parse('2026-10-15T06:00:00Z'),q={symbol:'^SET.BK',quoteType:'INDEX',currency:'THB',exchange:'SET',regularMarketPrice:1500,regularMarketChangePercent:1.2,regularMarketTime:new Date(now-900000)};
 assert.equal(validateSetIndexQuote(q,now).symbol,'SET');
 for(const change of [{symbol:'PTT.BK'},{quoteType:'EQUITY'},{currency:'USD'},{exchange:'NMS'},{regularMarketTime:new Date(now+1)}])assert.equal(validateSetIndexQuote({...q,...change},now),null);
});
