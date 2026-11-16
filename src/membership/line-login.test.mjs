import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server.js';
import {GET as start} from '../app/api/auth/line/start/route.js';
import {GET as callback} from '../app/api/auth/line/callback/route.js';
import {sessionMember} from './store.mjs';
import {sharedDatabase} from '../storage/sqlite.mjs';
const dir=mkdtempSync(join(tmpdir(),'line-flow-'));
Object.assign(process.env,{DATABASE_PATH:join(dir,'fixture.sqlite'),APP_ORIGIN:'https://app.example',LINE_CHANNEL_ID:'12345',LINE_CHANNEL_SECRET:'fixture',LINE_REDIRECT_URI:'https://app.example/api/auth/line/callback',SESSION_SECRET:'fixture-session-secret-at-least-32-characters',PORTFOLIO_HASH_SECRET:'fixture-portfolio-secret-at-least-32-characters',NODE_ENV:'production'});
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
const callbackRequest=(flow,state)=>new NextRequest(`https://app.example/api/auth/line/callback?code=fixture&state=${state}`,{headers:{cookie:`nugaom_line_flow=${flow}`}});
test('LINE start uses PKCE and callback verifies identity, creates a session and rejects replay',async t=>{
 const response=await start(new NextRequest('https://app.example/api/auth/line/start'));
 const auth=new URL(response.headers.get('location')),flow=response.cookies.get('nugaom_line_flow').value;
 assert.equal(auth.origin,'https://access.line.me');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
 assert.equal(auth.searchParams.get('redirect_uri'),process.env.LINE_REDIRECT_URI);
 assert.match(response.headers.get('set-cookie'),/HttpOnly/i);assert.match(response.headers.get('set-cookie'),/Secure/i);
 let calls=0;t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls++;const body=options.body;
  if(url.endsWith('/token')){assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'),auth.searchParams.get('code_challenge'));return Response.json({id_token:'fixture-id-token'});}
  assert.equal(body.get('nonce'),auth.searchParams.get('nonce'));
  return Response.json({sub:'U'+'a'.repeat(32),name:'LINE fixture',nonce:auth.searchParams.get('nonce'),exp:Math.floor(Date.now()/1000)+300,iss:'https://access.line.me',aud:'12345'});
 });
 const result=await callback(callbackRequest(flow,auth.searchParams.get('state')));
 assert.equal(new URL(result.headers.get('location')).searchParams.get('auth'),'ok');
 assert.equal((await sessionMember(result.cookies.get('nugaom_session').value)).display_name,'LINE fixture');
 assert.equal((await callback(callbackRequest(flow,auth.searchParams.get('state')))).headers.get('location'),'https://app.example/account?auth=failed');assert.equal(calls,2);
});
test('wrong state is rejected before exchanging any credentials',async t=>{
 const response=await start(new NextRequest('https://app.example/api/auth/line/start'));
 const mock=t.mock.method(globalThis,'fetch',async()=>{throw Error('must not call provider');});
 const result=await callback(callbackRequest(response.cookies.get('nugaom_line_flow').value,'attacker'));
 assert.equal(new URL(result.headers.get('location')).searchParams.get('auth'),'failed');assert.equal(mock.mock.callCount(),0);
});
