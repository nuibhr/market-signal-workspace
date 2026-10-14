import { isAbsolute } from 'node:path';

// Configuration evidence only; never return credential values.
export function launchConfiguration(env = process.env) {
  let origin, callback;
  try { origin = new URL(env.APP_ORIGIN); callback = new URL(env.LINE_REDIRECT_URI); } catch {}
  const publicHttps = origin?.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
    && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash;
  const callbackMatches = Boolean(publicHttps && callback?.origin === origin.origin
    && callback.pathname === '/api/auth/line/callback' && !callback.search && !callback.hash && !callback.username && !callback.password);
  const checks = [];
  const add = (id, label, passed, detail) => checks.push({ id, label, status: passed ? 'ready' : 'blocked', detail });
  add('public-web', 'เว็บ HTTPS และ LINE callback', callbackMatches, callbackMatches ? 'callback ตรงกับเว็บลูกค้า' : 'ต้องตั้งเว็บ HTTPS และ callback ให้ตรงกัน');
  add('line', 'LINE Login', Boolean(env.LINE_CHANNEL_ID?.trim() && env.LINE_CHANNEL_SECRET?.trim()), 'ต้องมีการตั้งค่า LINE และทดสอบล็อกอินบนเว็บลูกค้า');
  add('session-security', 'คีย์ session และข้อมูลพอร์ต', env.SESSION_SECRET?.length >= 32 && env.PORTFOLIO_HASH_SECRET?.length >= 32 && env.SESSION_SECRET !== env.PORTFOLIO_HASH_SECRET, 'ใช้คีย์ยาวอย่างน้อย 32 ตัวและแยกคีย์กัน');
  add('admin-access', 'สิทธิผู้ดูแล', Boolean(env.ADMIN_LINE_IDS?.trim() && env.ADMIN_LINE_IDS.split(',').every(value => /^U[a-f0-9]{32}$/i.test(value.trim()))), 'ต้องกำหนด LINE ID ผู้ดูแลที่ถูกต้อง');
  const mode = env.STORAGE_PROVIDER || 'sqlite';
  add('storage', 'ข้อมูลสมาชิกและสัญญาณถาวร', mode === 'd1' || mode === 'sqlite' && isAbsolute(env.DATABASE_PATH || '') && env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED === 'true', 'ต้องใช้ D1 หรือยืนยัน SQLite บนเซิร์ฟเวอร์ถาวร');
  add('worker-auth', 'คีย์ยืนยันงานสแกน', env.AUTO_PICK_RUN_SECRET?.length >= 32, 'ต้องมีคีย์ยืนยันงานสแกนอย่างน้อย 32 ตัว');
  const backupKey = /^[a-f0-9]{64}$/i.test(env.BACKUP_ENCRYPTION_KEY || '');
  add('backup-key', 'ข้อมูลสำรองเข้ารหัส', backupKey, 'ต้องมีคีย์สำหรับสำรองข้อมูลเข้ารหัส');
  add('backup', 'สำรองนอกเครื่องและกู้คืน', backupKey && env.BACKUP_RECOVERY_CONFIRMED === 'true', 'ยืนยันหลังสำรองนอกเครื่องและทดสอบกู้คืนสำเร็จจริง');
  add('maintenance', 'การเปิดเว็บลูกค้า', env.LAUNCH_MAINTENANCE !== 'true', env.LAUNCH_MAINTENANCE === 'true' ? 'เว็บยังอยู่ในโหมด maintenance' : 'ยังต้องทดสอบเส้นทางลูกค้าบนเว็บจริง');
  if (env.AUTO_PICK_ENABLED === 'true' || env.AUTO_PICK_DR_ENABLED === 'true' || env.SETTRADE_APP_ID || env.BROKER_APP_ID) add('rights-thai-dr', 'สิทธิแสดงข้อมูลหุ้นไทยและ DR', env.SETTRADE_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิแสดงข้อมูล Settrade แก่สมาชิก');
  if (env.AUTO_PICK_US_ENABLED === 'true') add('rights-us', 'สิทธิแสดงข้อมูลหุ้นสหรัฐฯ', env.YAHOO_EOD_DISPLAY_RIGHTS_CONFIRMED === 'true' || Boolean(env.FMP_API_KEY && env.FMP_DISPLAY_RIGHTS_CONFIRMED === 'true'), 'ต้องยืนยันสิทธิข้อมูลรายวันจากผู้ให้บริการที่ใช้');
  if (env.TFEX_APP_ID || env.TFEX_APP_SECRET || env.TFEX_API_SECRET) add('rights-tfex', 'สิทธิแสดงกราฟ TFEX', env.TFEX_DISPLAY_RIGHTS_CONFIRMED === 'true', 'สิทธิกราฟและราคา TFEX ต้องยืนยันแยกจาก AutoPick');
  if (env.FMP_API_KEY) add('rights-fmp-quotes', 'สิทธิแสดงราคา FMP', env.FMP_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิ quote FMP แม้ปิด AutoPick');
  add('rights-history', 'สิทธิแสดงกราฟย้อนหลัง Yahoo', env.YAHOO_DISPLAY_RIGHTS_CONFIRMED === 'true', 'สิทธิกราฟย้อนหลังแยกจากสิทธิสัญญาณ US รายวัน');
  if (env.MARKETDX_API_KEY) add('rights-news', 'สิทธิแสดงข่าว', env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิแสดงข่าวแก่ลูกค้า');
  if (env.FRED_API_KEY) add('rights-macro', 'สิทธิแสดงข้อมูลเศรษฐกิจ', env.FRED_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิแสดงชุดข้อมูลเศรษฐกิจ');
  return { checks, publicOrigin: publicHttps ? origin.origin : null };
}
