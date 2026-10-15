import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customerFeed, customerSignal } from './customer-view.mjs';
import { replayThreeMonths } from './backtest.mjs';
import {thaiScanSymbols,drScanSymbols,usScanSymbols} from './runner.mjs';
const directory=mkdtempSync(join(tmpdir(),'nugaom-customer-review-'));
process.env.DATABASE_PATH=join(directory,'test.sqlite');
const {createSignal,signalResults}=await import('./store.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {backtestSummary}=await import('./backtest-summary.mjs');
test.after(()=>{sharedDatabase().close();rmSync(directory,{recursive:true,force:true});});
test('customer payload keeps levels and drops formula, gates, diagnostics and raw event detail',async () =>{
 const plan={entry:100,tp1:104,stopLoss:98,side:'LONG',features:{secretFormula:1},ruleVersion:'private',reasons:['private'],trigger:{formula:'private'}};
 const row=customerSignal({id:'x',symbol:'PTT',plan,events:[{type:'ENTRY',price:100,detail:'private'}]});
 assert.deepEqual(row.plan,{side:'LONG',entry:100,stopLoss:98,tp1:104});
 assert.equal('detail' in row.events[0],false);
 const feed=customerFeed({signals:[{plan}],events:[],outcomes:{OPEN:1},decisions:[{reason:'private'}],runs:[{slot:'private'}]});
 assert.equal('decisions' in feed,false);assert.equal('runs' in feed,false);
});
test('signal results default to seven records with a complete next page',async () =>{
 for(let index=0;index<9;index++)(await createSignal({market:'thai',symbol:`REVIEW${index}`,sessionDay:'2026-10-01',plan:{entry:100,stopLoss:98,tp1:104},source:'TEST'}));
 const first=(await signalResults()),next=(await signalResults({page:2}));
 assert.equal(first.pageSize,7);assert.equal(first.signals.length,7);assert.equal(next.signals.length,2);
 assert.equal(first.total,9);assert.equal(first.summary.entered,0);assert.equal(first.summary.winRate,null);
});
test('whole-market replay summary reports missing work without inventing wins',async () =>{
 const report=(await backtestSummary('all'));assert.equal(report.summary.expected,thaiScanSymbols().length+drScanSymbols().length+usScanSymbols().length);
 assert.equal(report.summary.processed,0);assert.equal(report.summary.winRate,null);assert.equal(report.coverageComplete,false);
});
test('an old first candle alone cannot certify a complete three-month backtest',async () =>{
 const daily=Array.from({length:80},(_,i)=>({time:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),open:100,high:101,low:99,close:100,volume:10000}));
 const report=replayThreeMonths({symbol:'AAPL',market:'us',daily,now:Date.UTC(2026,9,2)});
 assert.equal(report.coverageComplete,false);assert.equal(report.entries,0);assert.equal(report.winRate,null);
});
