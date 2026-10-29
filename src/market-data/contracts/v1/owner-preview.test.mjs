import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerPreviewAccess,ownerPreviewEnabled,OWNER_PREVIEW_COOKIE} from './owner-preview-policy.mjs';
const token='a'.repeat(64),now=Date.parse('2026-10-28T08:00:00Z');
const env={NUGAOM_REVIEW_MODE:'true',NUGAOM_OWNER_SOURCE_PREVIEW:'true',APP_ORIGIN:'http://127.0.0.1:3217',CANONICAL_OWNER_PREVIEW_TOKEN:token,CANONICAL_OWNER_PREVIEW_EXPIRES:String(now+3600000)};
const req=(url='http://127.0.0.1:3217/api/owner-preview',headers={})=>new Request(url,{headers:{cookie:OWNER_PREVIEW_COOKIE+'='+token,...headers}});
test('owner exploration requires a private capability, loopback origin, explicit review mode and expiry',()=>{
 assert.equal(ownerPreviewAccess(req(),env,now),true);
 assert.equal(ownerPreviewAccess(req('http://localhost:3217/api/owner-preview',{host:'127.0.0.1:3217'}),env,now),true,'Next may normalize loopback URL hostname; raw Host must still match');
 assert.equal(ownerPreviewAccess(req(undefined,{host:'attacker.invalid'}),env,now),false);
 for(const patch of [{NUGAOM_REVIEW_MODE:'false'},{NUGAOM_OWNER_SOURCE_PREVIEW:'false'},{APP_ORIGIN:'https://production.invalid'},{CANONICAL_OWNER_PREVIEW_EXPIRES:String(now-1)},{CANONICAL_OWNER_PREVIEW_TOKEN:''}])assert.equal(ownerPreviewEnabled({...env,...patch},now),false);
 for(const request of [req('https://production.invalid/api/owner-preview'),req(undefined,{origin:'https://attacker.invalid'}),req(undefined,{cookie:'nugaom_session=forged','x-role':'owner'}),req(undefined,{cookie:OWNER_PREVIEW_COOKIE+'='+'b'.repeat(64)})])assert.equal(ownerPreviewAccess(request,env,now),false);
});
