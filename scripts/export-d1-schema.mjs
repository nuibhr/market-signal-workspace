// Export schema only. No members, sessions, credentials or market data leave the local database.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { sharedDatabase } from '../src/storage/sqlite.mjs';
const rows=sharedDatabase().prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name").all();
// A schema snapshot is a private reference, never a replacement for an applied migration.
const output=resolve('data/schema-exports',`schema-${Date.now()}.sql`);
mkdirSync(dirname(output),{recursive:true,mode:0o700});
writeFileSync(output,'-- Schema reference only. No customer data or secrets.\n'+rows.map(row=>row.sql+';').join('\n\n')+'\n',{mode:0o600,flag:'wx'});
process.stdout.write(`Prepared schema reference: ${rows.filter(row=>row.type==='table').length} tables at ${output}.\n`);
