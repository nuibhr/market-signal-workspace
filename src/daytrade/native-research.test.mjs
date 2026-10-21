import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {nativeDaytradePolicy} from './native-policy.mjs';
import {minutesToNativeClose,nativeCandidateGates,netTargetPlan,replayNativeResearch} from './native-research.mjs';
import {initializeDaytrade,ingestBars,dashboard} from './store.mjs';
import {exitOnBar} from './engine.mjs';
const t=Date.parse('2026-10-15T04:00:00Z')/1000,asset={market:'thai',symbol:'PTT',instrumentId:'SET100:PTT'};
test('Thai/DR pause new signals while TFEX/CFD policy remains active',()=>{
 for(const m of ['thai','dr'])assert.equal(nativeDaytradePolicy(m).allowNewSignals,false);
 for(const m of ['tfex','us','forex'])assert.equal(nativeDaytradePolicy(m).allowNewSignals,true);
});
test('paused native collection expires pending plans, still closes active positions, and retains their evidence',()=>{
 const db=new DatabaseSync(':memory:');initializeDaytrade(db);const active={id:'old-open',market:'thai',symbol:'PTT',status:'OPEN',side:'LONG',sessionKey:'2026-10-15',signalTime:t-1800,publishedAt:(t-1800)*1000,plan:{entry:100,stop:98,target:104,risk:2,spread:0,feeBps:0,slippageBps:0},entryTime:t-900,lastBar:t-900,heldBars:1};
 const pending={id:'old-wait',market:'thai',symbol:'PTT',status:'WAITING',publishedAt:(t-900)*1000};
 for(const r of [active,pending])db.prepare('INSERT INTO daytrade_forward VALUES(?,?,?)').run('native:thai',r.id,JSON.stringify(r));
 db.prepare('INSERT INTO daytrade_cursor VALUES(?,?,?)').run('native:thai','PTT',JSON.stringify({last:t-900,active,pending,cooldown:0}));
 ingestBars(db,'native:thai',asset,[{time:t,open:100,high:105,low:99,close:104,volume:1000}],{now:(t+905)*1000,spread:0});
 const rows=db.prepare('SELECT body FROM daytrade_forward').all().map(r=>JSON.parse(r.body));assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='old-open').status,'CLOSED');assert.equal(rows.find(r=>r.id==='old-open').reason,'TP');assert.equal(rows.find(r=>r.id==='old-wait').reason,'RESEARCH_PAUSED');assert.equal(rows.find(r=>r.id==='old-wait').status,'EXPIRED');
 const feed=dashboard(db,null,'thai',{compact:true});assert.equal(feed.policy.status,'research-paused');assert.ok(feed.universe.every(r=>!r.side&&!r.ranking));db.close();
});
test('research filters late sessions and expensive ticks and solves the target after assumed exit costs',()=>{
 assert.equal(minutesToNativeClose(t),90);assert.equal(minutesToNativeClose(t+3600),30);assert.equal(minutesToNativeClose(Date.parse('2026-10-15T06:00:00Z')/1000),0);
 const bars=Array.from({length:25},()=>({close:100,volume:10000}));bars[24].volume=20000;
 const setup={trigger:100,atr:2},p={entry:100,stop:97,risk:3,feeBps:10,slippageBps:5,spread:0};
 assert.ok(nativeCandidateGates(asset,bars,24,setup,t,p).every(([,pass])=>pass));
 assert.equal(nativeCandidateGates(asset,bars,24,setup,t+3600,p).find(([c])=>c==='TIME_LEFT')[1],false);
 assert.equal(nativeCandidateGates(asset,bars,24,setup,t,{...p,entry:0.64}).find(([c])=>c==='TICK_COST')[1],false);
 const fixed=netTargetPlan(asset,p);const trade={side:'LONG',plan:fixed,sessionKey:'2026-10-15',heldBars:1};const result=exitOnBar(asset,trade,{time:t,open:100,high:fixed.target,low:99,close:fixed.target,volume:1},null);assert.ok(result.netR>=2);
});
test('delayed research never enters before publication and extending the series preserves completed trades',()=>{
 const fx={market:'forex',symbol:'XAUUSD',instrumentId:'gold',trade_mode:4,point:.01};const base=Date.parse('2026-10-12T01:00:00Z')/1000;
 const rows=Array.from({length:150},(_,i)=>({time:base+i*900,open:100+i*.12-.05,high:100+i*.12+.1,low:100+i*.12-.4,close:100+i*.12,volume:10000}));
 const short=replayNativeResearch(fx,rows.slice(0,110),{now:(rows[109].time+900)*1000}),long=replayNativeResearch(fx,rows,{now:(rows.at(-1).time+900)*1000});assert.ok(short.trades.length>0);
 for(const trade of short.trades){assert.ok(trade.entryTime>=trade.availableAt+905);assert.deepEqual(long.trades.find(r=>r.signalTime===trade.signalTime),trade);}
});
