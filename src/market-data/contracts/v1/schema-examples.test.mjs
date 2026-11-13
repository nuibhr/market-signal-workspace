import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {projectEnvelope} from './pipeline.mjs';
const schema=JSON.parse(readFileSync(new URL('../../../../schemas/nugaom-market-data-envelope.v1.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({strict:false});addFormats(ajv);const validate=ajv.compile(schema);
test('both contract JSON examples compile and validate directly against draft 2020-12',()=>{
 const contract=readFileSync(new URL('../../../../nugaom-canonical-market-data-contract-v1.md',import.meta.url),'utf8');
 const examples=[...contract.matchAll(/```json\s*([\s\S]*?)```/g)].map(m=>JSON.parse(m[1])).filter(x=>x.schemaVersion);
 assert.equal(examples.length,2);for(const example of examples)assert.equal(validate(example),true,JSON.stringify(validate.errors));
});
test('JSON schema alone rejects Starter/Pro oversized record arrays, independent of semantic checks',()=>{
 const rows=Array.from({length:8},(_,i)=>({market:'thai',symbol:'S'+i,instrumentId:'SET:S'+i,dataKind:'SCANNER_CANDIDATE',providerState:'UNAVAILABLE'}));
 for(const [tier,cap] of [['STARTER',3],['PRO',5]]){
  const envelope=projectEnvelope(rows,{market:'thai',tier:'TRIAL',now:Date.parse('2026-10-26T12:00:00Z')});
  envelope.entitlement.tier=tier;envelope.entitlement.maxFullCards=cap;assert.equal(validate(envelope),false);
 }
});
