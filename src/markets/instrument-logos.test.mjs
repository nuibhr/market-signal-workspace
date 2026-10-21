import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOCAL_INSTRUMENT_LOGOS} from './local-logos.mjs';
import {instrumentIdentity} from './instrument-identity.mjs';
test('every bundled Thai/DR logo resolves to a real PNG inside public, with source provenance and no external image request',()=>{
 const sources=JSON.parse(readFileSync(new URL('../../public/instrument-logos/sources.json',import.meta.url),'utf8'));
 for(const [key,entry] of Object.entries(LOCAL_INSTRUMENT_LOGOS)){
  const [market,symbol]=key.split(':');
  assert.equal(instrumentIdentity({market,symbol}).url,entry.url);
  assert.match(entry.url,/^\/instrument-logos\/(thai|dr)\/[A-Z0-9-]+\.png$/);
  const bytes=readFileSync(new URL(`../../public${entry.url}`,import.meta.url));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.deepEqual(sources.entries[key],entry);assert.match(entry.identitySource,/^https:\/\/www.set.or.th\//);
 }
 assert.ok(LOCAL_INSTRUMENT_LOGOS['thai:PTT']);assert.ok(LOCAL_INSTRUMENT_LOGOS['dr:MSFT80']);
 assert.equal(LOCAL_INSTRUMENT_LOGOS['dr:NIKE80'].companyImageTicker,'NKE');
 assert.equal(LOCAL_INSTRUMENT_LOGOS['dr:BOEING80'].companyImageTicker,'BA');
 assert.equal(instrumentIdentity({market:'dr',symbol:'UNKNOWN80'}).url,null);
 assert.equal(instrumentIdentity({market:'thai',symbol:'../../etc/passwd'}).url,null);
});
