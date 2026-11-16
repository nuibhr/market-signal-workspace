import test from 'node:test';import assert from 'node:assert/strict';
import {releaseReadiness} from './release-readiness.mjs';
const revision='a'.repeat(40),now=Date.parse('2026-10-28T00:00:00Z');
const base={schemaVersion:1,revision,environment:{name:'fixture',kind:'staging',origin:'https://staging.example'},scope:[{market:'thai',providers:['settrade'],features:['quotes','charts']}],gates:{}};
function complete(){
 const m=structuredClone(base),ids=releaseReadiness(m,{revision,now}).pending;
 for(const id of ids)m.gates[id]={status:'PASS',revision,reviewer:'Fixture reviewer',verifiedAt:'2026-10-27T00:00:00Z',validUntil:'2026-10-29T00:00:00Z'};
 return {m,verifiedFiles:new Set(ids)};
}
test('missing gates, dirty source or a different revision cannot produce GO',()=>{
 const {m,verifiedFiles}=complete();
 assert.equal(releaseReadiness(m,{revision,now,verifiedFiles}).verdict,'GO');
 for(const patch of [{clean:false},{revision:'b'.repeat(40)},{verifiedFiles:new Set()}])assert.equal(releaseReadiness(m,{revision,now,verifiedFiles,...patch}).verdict,'NO-GO');
});
test('fixture, expired, future or unreviewed claims do not close readiness gates',()=>{
 for(const patch of [{fixture:true},{validUntil:'2020-01-01T00:00:00Z'},{verifiedAt:'2030-01-01T00:00:00Z'},{reviewer:''},{revision:'b'.repeat(40)}]){
  const {m,verifiedFiles}=complete();Object.assign(m.gates['rights:thai:settrade'],patch);
  assert.ok(releaseReadiness(m,{revision,now,verifiedFiles}).pending.includes('rights:thai:settrade'));
 }
});
test('adding markets, fallback sources or signal/performance requires additional evidence',()=>{
 const {m,verifiedFiles}=complete();m.scope[0].providers.push('yahoo');m.scope[0].features.push('signals','performance');
 const pending=releaseReadiness(m,{revision,now,verifiedFiles}).pending;
 for(const id of ['rights:thai:yahoo','strategy:thai','performance:thai'])assert.ok(pending.includes(id));
 for(const scope of [[],[{market:'bogus',providers:['settrade'],features:['quotes']}],[{market:'thai',providers:['unknown'],features:['quotes']}],[{market:'thai',providers:['settrade'],features:['execution']}]] )assert.ok(releaseReadiness({...m,scope},{revision,now,verifiedFiles}).pending.includes('scope'));
});
