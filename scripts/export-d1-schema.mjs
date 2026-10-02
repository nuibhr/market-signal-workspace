// Export schema only. No members, sessions, credentials or market data leave the local database.
import { mkdirSync, writeFileSync } from 'node:fs';
import { sharedDatabase } from '../src/membership/store.mjs';
import { signalResults } from '../src/auto-pick/store.mjs';
import { backtestSummary } from '../src/auto-pick/backtest-summary.mjs';
signalResults(); backtestSummary();
const rows=sharedDatabase().prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all();
mkdirSync('deploy/cloudflare/migrations',{recursive:true});
writeFileSync('deploy/cloudflare/migrations/0001_existing_schema.sql', '-- Schema only: generated from existing app. No customer data or secrets.\n'+rows.map(row=>row.sql+';').join('\n\n')+'\n');
process.stdout.write(`Prepared D1 schema: ${rows.filter(row=>row.type==='table').length} tables.\n`);
