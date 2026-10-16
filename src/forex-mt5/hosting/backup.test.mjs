import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backupStores, verifyBackup } from './backup.mjs';
import { decryptSnapshot } from '../../security/backup.mjs';

test('encrypted backup restores both stores including live committed WAL content without changing sources', () => {
  const folder = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const secret = 'a'.repeat(64);
  const paths = ['membership', 'forex'].map(name => join(folder, `${name}.sqlite`));
  const live = paths.map(path => new DatabaseSync(path));
  try {
    for (const db of live) db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE proof(v); INSERT INTO proof VALUES('private fixture');");
    const result = backupStores({ membership: paths[0], forex: paths[1], directory: join(folder, 'encrypted'), secret });
    assert.equal(result.restored, true);
    assert.deepEqual(result.missing, []);
    assert.equal(result.databases.length, 2);
    assert.equal(readFileSync(result.file).includes(Buffer.from('private fixture')), false);
    const manifest = JSON.parse(decryptSnapshot(readFileSync(result.file), secret));
    for (const entry of manifest.entries) {
      const restored = join(folder, `${entry.name}-restored.sqlite`);
      writeFileSync(restored, Buffer.from(entry.data, 'base64'));
      const db = new DatabaseSync(restored, { readOnly: true });
      try { assert.equal(db.prepare('SELECT v FROM proof').get().v, 'private fixture'); }
      finally { db.close(); }
    }
    assert.equal(live[0].prepare('SELECT count(*) AS n FROM proof').get().n, 1);
    assert.throws(() => verifyBackup({ file: result.file, secret: 'b'.repeat(64) }));
    const tampered = readFileSync(result.file); tampered[tampered.length - 1] ^= 1;
    writeFileSync(join(folder, 'tampered.enc'), tampered);
    assert.throws(() => verifyBackup({ file: join(folder, 'tampered.enc'), secret }));
  } finally { for (const db of live) db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('missing Forex is explicit preview only and backup directory must be private', () => {
  const folder = mkdtempSync(join(tmpdir(), 'backup-preview-'));
  const membership = join(folder, 'membership.sqlite'), forex = join(folder, 'missing.sqlite');
  const db = new DatabaseSync(membership); db.exec('CREATE TABLE proof(v)'); db.close();
  const options = { membership, forex, directory: join(folder, 'encrypted'), secret: 'a'.repeat(64) };
  try {
    assert.throws(() => backupStores(options), /DATABASE_MISSING/);
    assert.deepEqual(backupStores({ ...options, preview: true }).missing, ['forex']);
    chmodSync(options.directory, 0o755);
    assert.throws(() => backupStores({ ...options, preview: true }), /PRIVATE_BACKUP_DIRECTORY_REQUIRED/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
