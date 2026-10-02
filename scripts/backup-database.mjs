import { backupDatabase } from '../src/security/backup.mjs';
process.umask(0o077);
try { process.stdout.write(`Encrypted database backup saved: ${backupDatabase()}\n`); }
catch { process.stderr.write('Backup failed. Check encryption key, storage permissions and database availability.\n'); process.exitCode = 1; }
