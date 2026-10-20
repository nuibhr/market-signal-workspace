import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMarketStructure } from './structure.mjs';

describe('Developer Structure Engine', () => {
  it('returns error when bars count is less than 10', () => {
    const res = analyzeMarketStructure([{ open: 1, high: 2, low: 0.5, close: 1.5 }]);
    assert.equal(res.status, 'error');
    assert.equal(res.code, 'INSUFFICIENT_BARS');
  });

  it('analyzes valid candle sequence and extracts structure and 2R plan', () => {
    // Generate 30 ascending candles
    const sampleCandles = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 100 + i * 1.0,
      high: 102 + i * 1.0,
      low: 99.5 + i * 1.0,
      close: 101.5 + i * 1.0,
      volume: 1000 + i * 50,
    }));

    const res = analyzeMarketStructure(sampleCandles);
    assert.equal(res.status, 'success');
    assert.equal(res.barsAnalyzed, 30);
    assert.ok(res.structure);
    assert.ok(res.structure.equilibrium > 0);
    assert.ok(res.plan);
    assert.equal(res.plan.riskRewardRatio, '1:2.0');
    assert.equal(res.plan.breakevenWinRateRequired, '33.3%');
    assert.ok(res.plan.entryPrice > 0);
    assert.ok(res.plan.stopLoss > 0);
    assert.ok(res.plan.targetPrice > 0);
  });
});

it('rejects missing OHLC, invalid chronology, duplicates and non-finite prices without producing a plan',()=>{
 const valid=Array.from({length:10},(_,i)=>({time:1700000000+i*900,open:100,high:102,low:99,close:101}));
 for(const bars of [Array(10).fill({}),valid.map(b=>({...b,high:1})),valid.map(b=>({...b,close:Infinity})),[...valid.slice(0,9),valid[0]],Array(501).fill(valid[0])]){
  const result=analyzeMarketStructure(bars);assert.equal(result.status,'error');assert.equal(result.plan,undefined);
 }
});
it('HTTP structure endpoint rejects invalid and oversized inputs but preserves array and object contracts',async()=>{
 const {POST}=await import('../app/api/developers/structure/route.js');
 const valid=Array.from({length:10},(_,i)=>({time:1700000000+i*900,open:100+i,high:102+i,low:99+i,close:101+i}));
 const request=body=>new Request('http://localhost/api/developers/structure',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await POST(request(Array(10).fill({})))).status,400);
 assert.equal((await POST(request(valid))).status,200);assert.equal((await POST(request({candles:valid}))).status,200);
 assert.equal((await POST(request({candles:[],padding:'x'.repeat(128001)}))).status,413);
});
