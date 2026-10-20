import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {POST,DELETE} from '../app/api/auth/demo/route.js';
const dir=mkdtempSync(join(tmpdir(),'disabled-demo-'));
process.env.DATABASE_PATH=join(dir,'fixture.sqlite');
process.env.SESSION_SECRET='fixture-session-secret-at-least-32-characters';
const {storage}=await import('../storage/database.mjs');
const {sharedDatabase}=await import('../storage/sqlite.mjs');
const {createSession,sessionMember}=await import('./store.mjs');
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
