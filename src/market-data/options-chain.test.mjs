import test from 'node:test';import assert from 'node:assert/strict';import {summarizeOptionChain} from './options-chain.mjs';
test('PCR and payout minimum use the returned chain rather than fixed headline values',()=>{
 const rows=[{strike:100,callOi:20,putOi:10},{strike:110,callOi:5,putOi:30}];
 const r=summarizeOptionChain(rows);assert.equal(r.totalCallOi,25);assert.equal(r.totalPutOi,40);assert.equal(r.pcr,1.6);assert.equal(r.maxPain,110);
});
test('missing OI stays unknown and is never reported as a zero or fair market',()=>{
 assert.deepEqual(summarizeOptionChain([{strike:100,callOi:null,putOi:null}]),{totalCallOi:null,totalPutOi:null,pcr:null,maxPain:null,covered:0});
});
