import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const temporary = mkdtempSync(join(tmpdir(), 'nugaom-security-'));
process.env.DATABASE_PATH = join(temporary, 'test.sqlite');
process.env.SESSION_SECRET = 's'.repeat(64);
const { createLineFlow, consumeLineFlow, sharedDatabase } = await import('../membership/store.mjs');
const { readJsonBody, rateLimit } = await import('./request-guard.mjs');
const { backupDatabase, decryptSnapshot } = await import('./backup.mjs');
test.after(() => { sharedDatabase().close(); rmSync(temporary, { recursive: true, force: true }); });
test('LINE flow is opaque, expires server side and can only be consumed once', () => {
  const flow = createLineFlow();
  assert.notEqual(flow.value, flow.state);
  assert.equal(consumeLineFlow(flow.value).state, flow.state);
  assert.equal(consumeLineFlow(flow.value), null);
  assert.equal(consumeLineFlow('forged'), null);
});
test('streamed JSON enforces size even without content-length', async () => {
  const request = body => new Request('http://localhost/', { method:'POST', headers:{'Content-Type':'application/json'}, body });
  assert.deepEqual(await readJsonBody(request('{"ok":true}')), { ok:true });
  await assert.rejects(readJsonBody(request('x'.repeat(50)), 20), { message:'PAYLOAD_TOO_LARGE' });
  await assert.rejects(readJsonBody(request('[]')), { message:'INVALID_JSON' });
});
test('request limit is atomic and isolated by member', () => {
  assert.equal(rateLimit('test','one',2), null);
  assert.equal(rateLimit('test','one',2), null);
  assert.equal(rateLimit('test','one',2).status,429);
  assert.equal(rateLimit('test','two',2), null);
});
test('encrypted SQLite snapshot restores intact and rejects tampering', () => {
  const secret = 'a'.repeat(64);
  const path = backupDatabase({ secret, directory: join(temporary,'backups') });
  const ciphertext = readFileSync(path);
  const recovered = join(temporary,'recovered.sqlite');
  writeFileSync(recovered, decryptSnapshot(ciphertext,secret));
  const db = new DatabaseSync(recovered, { readOnly:true });
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM request_limits').get().n,2);
  db.close();
  ciphertext[ciphertext.length-1] ^= 1;
  assert.throws(() => decryptSnapshot(ciphertext,secret));
});
