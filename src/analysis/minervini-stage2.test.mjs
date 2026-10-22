import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMinerviniStage2,relativeStrength,stage2RiskPlan} from './minervini-stage2.mjs';
import {thaiResearchCosts} from './swing-standard.mjs';
const now=Date.parse('2026-10-21T12:00:00Z');
function history(count=300){const bars=[];let stamp=Date.parse('2026-10-20T00:00:00Z');while(bars.length<count){const day=new Date(stamp);if(![0,6].includes(day.getUTCDay()))bars.unshift({time:day.toISOString().slice(0,10)});stamp-=86400000;}return bars.map((b,i)=>{const p=40+i*.2;return {...b,open:p-.1,close:p,high:p+.4,low:p-.4,volume:10000};});}
const stock=history(),benchmark=stock.map((b,i)=>({time:b.time,close:1000+i}));
test('EMA adaptation evaluates all eight checks with actual SET-relative returns, without creating a trade',()=>{
 const a=evaluateMinerviniStage2(stock,{benchmarkBars:benchmark,now});assert.equal(a.stage,2);assert.equal(a.score,8);assert.equal(a.templatePass,true);assert.equal(a.referenceOnly,true);assert.ok(a.rs.excessReturnPercent>0);assert.equal(a.rvol,1);assert.equal(a.ruleVersion,'thai-ema-stage2-context-v1');
});
test('seven checks cannot compensate for failing RS; missing benchmark is unknown rather than a passing Stage 2',()=>{
 const strong=stock.map((b,i)=>({time:b.time,close:100+i*10}));
 const weak=evaluateMinerviniStage2(stock,{benchmarkBars:strong,now});assert.equal(weak.score,7);assert.equal(weak.criteria[7].passed,false);assert.equal(weak.templatePass,false);
 const missing=evaluateMinerviniStage2(stock,{now});assert.equal(missing.criteria[7].passed,null);assert.equal(missing.templatePass,false);assert.equal(missing.status,'partial');
});
test('short histories do not invent a 52-week high/low or a twenty-day EMA200 trend',()=>{
 assert.equal(evaluateMinerviniStage2(stock.slice(-219),{now}).code,'NEED_220_CLOSED_DAYS');
 assert.equal(evaluateMinerviniStage2(stock.slice(-219),{now}).price,stock.at(-1).close,'short history still displays an observed price without inventing a Stage');
 const partial=evaluateMinerviniStage2(stock.slice(-230),{benchmarkBars:benchmark,now});assert.equal(partial.criteria[5].passed,null);assert.equal(partial.criteria[6].passed,null);assert.equal(partial.yearHigh,null);assert.equal(partial.templatePass,false);
});
test('future/open daily bars cannot alter the score; stale, duplicate or corrupt data cannot qualify',()=>{
 const base=evaluateMinerviniStage2(stock,{benchmarkBars:benchmark,now});
 const future={time:'2026-10-22',open:500,high:500,low:500,close:500,volume:100000};
 assert.deepEqual(evaluateMinerviniStage2([...stock,future],{benchmarkBars:benchmark,now}),base);
 assert.equal(evaluateMinerviniStage2([...stock,stock.at(-1)],{now}).code,'INVALID_DAILY_BARS');
 assert.equal(evaluateMinerviniStage2([{...stock[0],high:0},...stock.slice(1)],{now}).status,'unavailable');
 const stale=evaluateMinerviniStage2(stock,{benchmarkBars:benchmark,now:now+12*86400000});assert.equal(stale.templatePass,false);assert.equal(stale.status,'stale');
});
test('RS requires the same final trading date and 64 matched observations, and uses the requested window',()=>{
 assert.equal(relativeStrength(stock,benchmark.slice(0,-1)).status,'unavailable');
 assert.equal(relativeStrength(stock.slice(-30),benchmark).status,'unavailable');
 assert.equal(relativeStrength(stock.filter((_,i)=>i!==stock.length-15),benchmark).code,'RS_CALENDAR_GAP');
 assert.notEqual(relativeStrength(stock,benchmark,{lookback:20}).excessReturnPercent,relativeStrength(stock,benchmark,{lookback:63}).excessReturnPercent);
});
test('risk assessment uses structural stops and rejects a wider-than-eight-percent stop rather than clipping it',()=>{
 const wide=stock.map((b,i)=>({...b,high:b.close+15,low:b.close-15+(i%4===0?-1:0)}));
 assert.equal(stage2RiskPlan(wide,thaiResearchCosts()),null);
});
