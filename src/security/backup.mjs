import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { sharedDatabase } from '../storage/sqlite.mjs';
const MAGIC = Buffer.from('NUGAOM01');
function key(value) {
  if (!/^[a-f0-9]{64}$/i.test(value ?? '')) throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters');
  return Buffer.from(value, 'hex');
}
export function encryptSnapshot(data, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptSnapshot(data, secret) {
  if (data.length < 36 || !data.subarray(0,8).equals(MAGIC)) throw new Error('INVALID_BACKUP');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), data.subarray(8,20));
  decipher.setAAD(MAGIC); decipher.setAuthTag(data.subarray(20,36));
  return Buffer.concat([decipher.update(data.subarray(36)), decipher.final()]);
}
export function backupDatabase({ secret = process.env.BACKUP_ENCRYPTION_KEY, directory = process.env.BACKUP_DIRECTORY || './data/backups' } = {}) {
  key(secret);
  const temporary = mkdtempSync(join(tmpdir(), 'nugaom-backup-'));
  try {
    const snapshot = join(temporary, 'snapshot.sqlite');
    // SQLite creates a consistent snapshot including committed WAL writes.
    sharedDatabase().exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
    const destination = resolve(directory);
    mkdirSync(destination, { recursive: true, mode: 0o700 });
    const path = join(destination, `nugaom-${new Date().toISOString().replaceAll(':','-')}-${randomBytes(4).toString('hex')}.enc`);
    writeFileSync(path, encryptSnapshot(readFileSync(snapshot), secret), { mode: 0o600, flag: 'wx' });
    return path;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
