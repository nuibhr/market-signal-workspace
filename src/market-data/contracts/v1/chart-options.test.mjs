import test from 'node:test';
import assert from 'node:assert/strict';
import {createChartHandler} from './chart-handlers.mjs';
import {createOptionsHandler} from './options-handlers.mjs';
const now=Date.parse('2026-10-26T12:00:00Z');
const evidence=()=>Object.fromEntries(['settrade','yahoo'].map(id=>[id,{status:'CONFIRMED',markets:['thai','tfex'],evidenceId:'FIXTURE_ONLY',verifiedAt:'2026-10-01T00:00:00Z',validUntil:'2026-11-01T00:00:00Z'}]));
const assets=Array.from({length:8},(_,i)=>({id:'thai',symbol:'S'+i,instrumentId:'SET:S'+i}));
const request=q=>new Request('https://fixture.invalid/api/chart?'+q);
test('chart handoff stays within selected-market entitlement before provider calls',async()=>{
 let calls=0;
 const GET=createChartHandler({clock:()=>now,assets,scanAssets:()=>assets,market:'thai',currentMember:async()=>({id:'fixture'}),membershipFor:()=>({tier:'subscriber',planId:'starter'}),evidence,
 closedAt:()=>now-1000,read:async()=>{calls++;return Response.json({symbol:'S0',instrumentId:'SET:S0',timeframe:'1d',source:'Settrade',receivedAt:'2026-10-26T11:00:00Z',bars:[{time:'2026-10-26',open:1,high:2,low:1,close:2,volume:1}]});}});
 assert.equal((await GET(request('symbol=S7&timeframe=1d'))).status,403);assert.equal(calls,0);
 assert.equal((await GET(request('market=dr&symbol=S0'))).status,400);assert.equal(calls,0);
 const r=await GET(request('symbol=S0&timeframe=1d'));assert.equal(r.status,200);const body=await r.json();assert.equal(body.signalEligible,false);assert.equal(body.chartOnly,true);assert.equal(body.receivedAt,'2026-10-26T11:00:00Z');assert.equal(body.bars.length,1);
});
test('rights denial returns before chart/provider calls even in development',async()=>{
 const GET=createChartHandler({assets,scanAssets:()=>assets,market:'thai',currentMember:async()=>({}),membershipFor:()=>({tier:'trial'}),evidence:()=>({}),closedAt:()=>now,read:()=>{throw Error('must not read');}});
 assert.equal((await GET(request('symbol=S0'))).status,503);
});
test('options cap applies to contracts before provider reads and before legacy summary',async()=>{
 const calls=[];
 const GET=createOptionsHandler({clock:()=>now,currentMember:async()=>({}),membershipFor:()=>({tier:'subscriber',planId:'starter'}),evidence,contracts:()=>[{root:'S50',symbol:'S50Z26'}],
 getQuote:async symbol=>{calls.push(symbol);return {symbol,status:'available',price:900,openInterest:null,observedAt:'2026-10-26T11:59:59Z',receivedAt:'2026-10-26T11:59:59Z',token:'SECRET'};}});
 const body=await(await GET(request('series=S50Z26'))).json();assert.equal(calls.length,4);assert.equal(body.rows.length,2);assert.equal(body.summary.totalCallOi,null);assert.ok(!JSON.stringify(body).includes('SECRET'));assert.equal(body.underlyingPrice,null);
 const canonical=await(await GET(request('series=S50Z26&format=canonical'))).json();assert.equal(canonical.records.length,3);assert.ok(canonical.records.every(r=>!r.source.isLiveFeed));
});
