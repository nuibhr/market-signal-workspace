import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {POST,DELETE} from '../app/api/auth/demo/route.js';
import {NextRequest} from 'next/server.js';
import {DEMO_COOKIE} from './demo-policy.mjs';
import {membershipFor} from './rights.mjs';
const dir=mkdtempSync(join(tmpdir(),'disabled-demo-'));
process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
process.env.SESSION_SECRET='fixture-session-secret-at-least-32-characters';
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {createSession,sessionMember,reserveAiQuestion,completeAiQuestion,aiQuota,isAdmin}=await import('./store.mjs');
const {checkout}=await import('../billing/store.mjs');
test.after(()=>{sharedDatabase().close();rmSync(dir,{recursive:true,force:true});});
test('anonymous demo login is disabled without creating members or sessions',async()=>{
 const before=await storage.first('SELECT COUNT(*) AS n FROM members');
 for(const role of ['trial','subscriber']){
  const response=await POST(new Request('http://localhost/api/auth/demo',{method:'POST',body:JSON.stringify({role})}));
  assert.equal(response.status,404);assert.equal(response.headers.get('set-cookie'),null);
 }
 assert.equal((await DELETE()).status,404);
 assert.equal((await storage.first('SELECT COUNT(*) AS n FROM members')).n,before.n);
 assert.equal((await storage.first('SELECT COUNT(*) AS n FROM sessions')).n,0);
});
test('previous shared demo sessions are rejected while real member sessions remain valid',async()=>{
 for(const [id,line] of [['real-fixture','real-line'],['demo-subscriber-member','Udemo_subscriber_nugaom_7788']]){
  await storage.run('INSERT INTO members(id,line_id,display_name,created_at,updated_at) VALUES(?,?,?,?,?)',id,line,'fixture','2026-10-20','2026-10-20');
  const session=await createSession(id);assert.equal((await sessionMember(session.value))?.id??null,id.startsWith('demo-')?null:id);
 }
});
test('missing or weak session secrets fail closed',async()=>{
 const prior=process.env.SESSION_SECRET;
 for(const secret of ['', 'short']){
  process.env.SESSION_SECRET=secret;await assert.rejects(createSession('real-fixture'),/SESSION_SECRET_REQUIRED/);
  assert.equal(await sessionMember('unknown'),null);
 }
 process.env.SESSION_SECRET=prior;
});
const request=(method,body,cookie,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/auth/demo',{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie:`${DEMO_COOKIE}=${cookie}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('demo roles are per browser, expire, preserve quota across switches and never grant admin/live billing',async()=>{
 process.env.APP_ORIGIN='http://localhost:3000';process.env.DEMO_LOGIN_ENABLED='true';
 try{
  assert.equal((await POST(request('POST',{role:'admin'}))).status,400);
  assert.equal((await POST(request('POST',{role:'ultimate'},null,'https://attacker.example'))).status,403);
  const login=await POST(request('POST',{role:'starter'}));assert.equal(login.status,200);
  let value=login.cookies.get(DEMO_COOKIE).value,member=await sessionMember(value);
  const id=member.id,expires=member.demo.expiresAt;
  assert.equal(membershipFor(member).limits.freeAiQuestionsDaily,10);
  assert.ok(Date.parse(expires)-Date.now()<=7200000);
  const q=crypto.randomUUID(),conversation=crypto.randomUUID();
  const reservation=await reserveAiQuestion(member,q,'test question',conversation);
  await completeAiQuestion(member,q,{answer:'Demo',sources:[]},null,reservation.reservationToken);
  for(const [role,tier,limit] of [['pro','subscriber',50],['ultimate','subscriber',150],['trial','trial',5],['expired','expired',0],['onboarding','onboarding',0]]){
   const response=await POST(request('POST',{role},value));assert.equal(response.status,200);
   assert.equal(await sessionMember(value),null,'rotated demo token is revoked');
   value=response.cookies.get(DEMO_COOKIE).value;member=await sessionMember(value);
   assert.equal(member.id,id);assert.equal(member.demo.expiresAt,expires);
   const rights=membershipFor(member);assert.equal(rights.tier,tier);assert.equal(rights.limits.freeAiQuestionsDaily,limit);
   assert.equal((await aiQuota(member)).freeUsed,1,'changing tier does not reset usage');
   process.env.ADMIN_LINE_IDS=member.line_id;assert.equal(isAdmin(member),false);
  }
  const other=await POST(request('POST',{role:'ultimate'}));
  assert.notEqual((await sessionMember(other.cookies.get(DEMO_COOKIE).value)).id,id);
  process.env.STRIPE_SECRET_KEY='sk_live_fixture';
  await assert.rejects(checkout(member,'starter',{stripe:{}}),/DEMO_BILLING_TEST_ONLY/);
  assert.equal((await DELETE(request('DELETE',null,value))).status,200);assert.equal(await sessionMember(value),null);
  const token=other.cookies.get(DEMO_COOKIE).value;
  process.env.DEMO_LOGIN_ENABLED='false';assert.equal(await sessionMember(token),null);
 }finally{delete process.env.DEMO_LOGIN_ENABLED;delete process.env.STRIPE_SECRET_KEY;delete process.env.ADMIN_LINE_IDS;}
});
