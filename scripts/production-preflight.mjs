import { isAbsolute } from 'node:path';
const checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
let origin, redirect;
try { origin = new URL(process.env.APP_ORIGIN); redirect = new URL(process.env.LINE_REDIRECT_URI); } catch {}
check('Public HTTPS origin and exact LINE callback', origin?.protocol === 'https:' && !['localhost','127.0.0.1'].includes(origin?.hostname)
  && redirect?.origin === origin?.origin && redirect?.pathname === '/api/auth/line/callback' && !redirect?.search && !redirect?.hash);
check('LINE credentials configured', process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
check('Session and portfolio secrets are independent', process.env.SESSION_SECRET?.length >= 32 && process.env.PORTFOLIO_HASH_SECRET?.length >= 32 && process.env.SESSION_SECRET !== process.env.PORTFOLIO_HASH_SECRET);
check('Administrator LINE IDs configured', process.env.ADMIN_LINE_IDS?.split(',').every(v => /^U[a-f0-9]{32}$/i.test(v.trim())));
check('Absolute database path on confirmed persistent server', isAbsolute(process.env.DATABASE_PATH ?? '') && process.env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED === 'true');
check('Worker authentication secret configured', process.env.AUTO_PICK_RUN_SECRET?.length >= 32);
check('Encrypted backup key configured', /^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY ?? ''));
if (process.env.AUTO_PICK_ENABLED === 'true' || process.env.AUTO_PICK_DR_ENABLED === 'true') check('SET/DR display permission confirmed', process.env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true');
if (process.env.AUTO_PICK_US_ENABLED === 'true') check('US display permission confirmed', process.env.FMP_DISPLAY_RIGHTS_CONFIRMED === 'true');
if (process.env.MARKETDX_API_KEY) check('News display permission confirmed', process.env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true');
if (process.env.FRED_API_KEY) check('Macro series display permission confirmed', process.env.FRED_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true');
for (const result of checks) process.stdout.write(`${result.passed ? 'PASS' : 'BLOCKED'} ${result.name}\n`);
process.stdout.write('This checks configuration only. Also verify HTTPS, backup recovery, provider access, scanner health and LINE login on the actual public domain.\n');
if (checks.some(item => !item.passed)) process.exitCode = 1;
