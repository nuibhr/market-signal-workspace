import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { encryptSnapshot, decryptSnapshot } from '../../security/backup.mjs';

const names = ['membership', 'forex'];
const maximum = 256 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function privateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('PRIVATE_BACKUP_DIRECTORY_REQUIRED');
}
function inspect(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').all().some(row => row.integrity_check !== 'ok') ||
        db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('BACKUP_INTEGRITY_FAILED');
    return { integrity: 'ok', tables: db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='table'").get().n };
  } finally { db.close(); }
}

// Each database is a consistent SQLite snapshot, including committed WAL writes.
// The two snapshots are sequential: pause ingestion/writes before migration cutover.
export function backupStores({ membership, forex, directory, secret, preview = false }) {
  if (resolve(membership) === resolve(forex)) throw new Error('SEPARATE_DATABASES_REQUIRED');
  if (!existsSync(membership) || (!preview && !existsSync(forex))) throw new Error('DATABASE_MISSING');
  const destination = resolve(directory);
  privateDirectory(destination);
  const temporary = mkdtempSync(join(tmpdir(), 'nugaom-stores-'));
  try {
    const entries = [];
    for (const [name, source] of [['membership', membership], ['forex', forex]]) {
      if (!existsSync(source)) continue;
      if (!lstatSync(source).isFile() || statSync(source).size > maximum) throw new Error('INVALID_DATABASE_FILE');
      const snapshot = join(temporary, `${name}.sqlite`);
      const db = new DatabaseSync(source, { readOnly: true });
      try {
        db.exec('PRAGMA busy_timeout=15000');
        db.exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
      } finally { db.close(); }
      const bytes = readFileSync(snapshot);
      if (bytes.length > maximum) throw new Error('BACKUP_TOO_LARGE');
      entries.push({ name, sha256: digest(bytes), data: bytes.toString('base64'), ...inspect(snapshot) });
    }
    const snapshot = { version: 1, createdAt: new Date().toISOString(), preview, entries };
    const file = join(destination, `stores-${snapshot.createdAt.replaceAll(':', '-')}-${randomBytes(4).toString('hex')}.enc`);
    const partial = `${file}.partial`;
    try {
      writeFileSync(partial, encryptSnapshot(Buffer.from(JSON.stringify(snapshot)), secret), { mode: 0o600, flag: 'wx' });
      const report = verifyBackup({ file: partial, secret });
      renameSync(partial, file);
      return { file, ...report };
    } finally { rmSync(partial, { force: true }); }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

// Restores only into a new private temporary directory; never touches live files.
export function verifyBackup({ file, secret }) {
  if (statSync(file).size > maximum * 3) throw new Error('BACKUP_TOO_LARGE');
  const snapshot = JSON.parse(decryptSnapshot(readFileSync(file), secret).toString('utf8'));
  if (snapshot.version !== 1 || !Array.isArray(snapshot.entries) || ![1, 2].includes(snapshot.entries.length) ||
      !snapshot.entries.some(entry => entry.name === 'membership') ||
      (!snapshot.preview && !snapshot.entries.some(entry => entry.name === 'forex')) ||
      new Set(snapshot.entries.map(entry => entry.name)).size !== snapshot.entries.length) throw new Error('INVALID_MANIFEST');
  const temporary = mkdtempSync(join(tmpdir(), 'nugaom-restore-check-'));
  try {
    const databases = snapshot.entries.map(entry => {
      if (!names.includes(entry.name) || typeof entry.data !== 'string') throw new Error('INVALID_MANIFEST');
      const bytes = Buffer.from(entry.data, 'base64');
      if (bytes.length > maximum || digest(bytes) !== entry.sha256) throw new Error('BACKUP_HASH_MISMATCH');
      const restored = join(temporary, `${entry.name}.sqlite`);
      writeFileSync(restored, bytes, { mode: 0o600, flag: 'wx' });
      return { name: entry.name, sha256: entry.sha256, bytes: bytes.length, ...inspect(restored) };
    });
    return { createdAt: snapshot.createdAt, restored: true, missing: names.filter(name => !databases.some(db => db.name === name)), databases };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const secret = process.env.BACKUP_ENCRYPTION_KEY;
    const result = process.argv[2] === '--verify'
      ? verifyBackup({ file: process.argv[3], secret })
      : backupStores({ membership: process.env.DATABASE_PATH, forex: process.env.FOREX_MT5_DATABASE_PATH,
          directory: process.env.BACKUP_DIRECTORY || '/var/backups/nugaom', secret,
          preview: process.env.FOREX_MT5_PREVIEW === 'true' });
    console.log(JSON.stringify(result));
  } catch {
    console.error(JSON.stringify({ error: 'BACKUP_FAILED', hint: 'Check private directory, database availability, encryption key and integrity.' }));
    process.exitCode = 1;
  }
}
