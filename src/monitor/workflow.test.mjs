import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURED_LIMIT,rankedRadarRows,pageRows,workflowRecords,workflowSummary} from './workflow.mjs';
import {candidateViews,startReferenceSignal,advanceReferenceSignal} from '../signals/model.mjs';
import {thaiResearchCosts} from '../analysis/swing-standard.mjs';

test('featured display caps at five without dropping the other scanned stocks; all scan pages cover every row once',()=>{
 const input=Array.from({length:14},(_,i)=>({symbol:`S${i}`,scored:{totalScore:i%16}}));
 const ranked=rankedRadarRows(input);assert.equal(ranked.slice(0,FEATURED_LIMIT).length,5);assert.equal(ranked.length,14);
 const first=pageRows(ranked,1),second=pageRows(ranked,2);assert.equal(first.rows.length,7);assert.equal(second.rows.length,7);
 assert.equal(new Set([...first.rows,...second.rows].map(r=>r.symbol)).size,14);assert.equal(input[0].symbol,'S0');
 assert.equal(pageRows(ranked,9).page,2);assert.equal(pageRows([],9).page,1);
});
test('a committed Swing signal moves from waiting to tracking to a single closed win after its runner finishes',()=>{
 const epoch=Date.parse('2026-10-15T03:00:00Z')/1000;
 const context={market:'thai',symbol:'PTT',instrumentId:'SET100:PTT',name:'PTT',status:'AVAILABLE',price:100,swingLow:98,atr:1,resistanceLevels:[],relativeVolume:1.2,trendD1:'up',matched:{breakout:true,pullback:false},latest4hTime:epoch-15300};
 const view=candidateViews(context,thaiResearchCosts())[0];
 const bar=(time,open=100,high=101,low=99,close=100)=>({time,open,high,low,close,volume:10000});
 const step=(signal,b)=>advanceReferenceSignal(signal,[b],context,(b.time+1800)*1000).signal;
 let signal=startReferenceSignal(view,'standard',epoch*1000);const id=signal.id;
 assert.equal(workflowRecords([],[signal])[0].bucket,'waiting');
 signal=step(signal,bar(epoch));assert.equal(workflowRecords([],[signal])[0].bucket,'tracking');
 const target=signal.plan.minimumTarget;
 signal=step(signal,bar(epoch+900,target+1,target+2,102,target+1));assert.equal(signal.status,'RUNNER');
 assert.equal(workflowSummary(workflowRecords([],[signal])).closed,0);
 const prior=structuredClone(signal);signal=step(signal,bar(epoch+1800,101,102,99,100));assert.equal(signal.id,id);
 const rows=workflowRecords([],[prior,signal,signal]);assert.equal(rows.length,1);assert.equal(rows[0].bucket,'closed');
 assert.equal(rows.filter(r=>r.bucket==='tracking').length,0);assert.equal(workflowSummary(rows).wins,1);
});
test('net R decides win or loss after costs; expiry, review, open trades and replay never enter win rate',()=>{
 const rows=workflowRecords([
  {id:'win',status:'CLOSED',netR:0.2,reason:'SL'},
  {id:'loss',status:'CLOSED',netR:-0.02,reason:'TP'},
  {id:'flat',status:'CLOSED',netR:0},
  {id:'review',status:'REVIEW',netR:2},
  {id:'expired',status:'EXPIRED'},
  {id:'open',status:'OPEN',netR:5},
  {id:'replay',status:'CLOSED',netR:9,origin:'replay'}
 ]);
 const summary=workflowSummary(rows);assert.deepEqual({...summary,winRate:undefined},{closed:3,wins:1,losses:1,flat:1,winRate:undefined});
 assert.ok(Math.abs(summary.winRate-100/3)<1e-10);assert.equal(rows.some(r=>r.id==='replay'),false);assert.equal(rows.find(r=>r.id==='win').outcome,'win');
 assert.equal(rows.find(r=>r.id==='loss').outcome,'loss');assert.equal(rows.filter(r=>r.bucket==='review').length,2);
});
test('same symbol across strategies retains separate immutable IDs; missing net outcome is held for review',()=>{
 const records=workflowRecords([{id:'same',symbol:'PTT',status:'CLOSED',netR:1}],[{id:'same',symbol:'PTT',status:'CLOSED',netR:-1},{id:'missing',status:'CLOSED'}]);
 assert.equal(records.length,3);assert.equal(workflowSummary(records).closed,2);assert.equal(records.find(r=>r.id==='missing').bucket,'review');
});
