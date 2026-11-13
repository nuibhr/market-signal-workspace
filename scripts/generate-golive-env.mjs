#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { launchConfiguration } from '../src/admin/launch-config.mjs';

const genHex64 = () => randomBytes(32).toString('hex');

const secrets = {
  SESSION_SECRET: genHex64(),
  PORTFOLIO_HASH_SECRET: genHex64(),
  AUTO_PICK_RUN_SECRET: genHex64(),
  BACKUP_ENCRYPTION_KEY: genHex64(),
};

console.log('======================================================================');
console.log('🔐 Nugaom AI Pick — Go-Live Security Keys Generator (64-char Hex)');
console.log('======================================================================');
console.log('# คัดลอก 4 บรรทัดนี้ไปวางในไฟล์ .env.production หรือ Cloudflare Env:');
console.log('');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log('');
console.log('======================================================================');
console.log('📋 ตรวจสอบความพร้อม Go-Live (Launch Readiness Check จากสภาพแวดล้อมปัจจุบัน)');
console.log('======================================================================');

const report = launchConfiguration({
  ...process.env,
  ...secrets,
});

for (const item of report.checks) {
  const icon = item.status === 'ready' ? '✅ [READY]  ' : '⚠️ [PENDING]';
  console.log(`${icon} ${item.label.padEnd(28, ' ')} — ${item.detail}`);
}
console.log('======================================================================');

