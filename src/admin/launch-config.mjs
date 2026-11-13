import { isAbsolute } from 'node:path';
import {displayRights} from '../market-data/contracts/v1/pipeline.mjs';
import { customerPreflight } from '../forex-mt5/customer-preflight.mjs';

// Configuration evidence only; never return credential values.
export function launchConfiguration(env = process.env, now=Date.now()) {
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
  let bridge;try{bridge=new URL(env.WEB_BRIDGE_URL);}catch{}
  const bridgeReady=bridge?.protocol==='https:'&&!bridge.username&&!bridge.password&&bridge.pathname==='/'&&!bridge.search&&!bridge.hash&&env.WEB_BRIDGE_SECRET?.length>=43;
  add('storage', 'ข้อมูลสมาชิกและสัญญาณถาวร', mode === 'd1' || mode === 'd1-http' && bridgeReady || mode === 'sqlite' && isAbsolute(env.DATABASE_PATH || '') && env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED === 'true', 'ต้องใช้ D1, D1 HTTP bridge ที่ตั้งค่าถูกต้อง หรือ SQLite บนเซิร์ฟเวอร์ถาวร');
  if(mode==='d1-http'){
    add('shared-daily','ข้อมูลส่วนกลางรายวัน',env.SHARED_MARKET_DATA_MODE==='daily','เว็บอ่าน snapshot จากฐานข้อมูลส่วนกลาง');
    add('origin-security','การป้องกัน VPS origin',env.VPS_ORIGIN_SECRET?.length>=43&&env.VPS_ORIGIN_SECRET!==env.WEB_BRIDGE_SECRET&&env.VPS_ORIGIN_SECRET!==env.SESSION_SECRET&&env.WEB_BRIDGE_SECRET!==env.SESSION_SECRET,'แยกคีย์ origin, bridge และ session');
  }
  add('worker-auth', 'คีย์ยืนยันงานสแกน', env.AUTO_PICK_RUN_SECRET?.length >= 32, 'ต้องมีคีย์ยืนยันงานสแกนอย่างน้อย 32 ตัว');
  const backupKey = /^[a-f0-9]{64}$/i.test(env.BACKUP_ENCRYPTION_KEY || '');
  add('backup-key', 'ข้อมูลสำรองเข้ารหัส', backupKey, 'ต้องมีคีย์สำหรับสำรองข้อมูลเข้ารหัส');
  add('backup', 'สำรองนอกเครื่องและกู้คืน', backupKey && env.BACKUP_RECOVERY_CONFIRMED === 'true', 'ยืนยันหลังสำรองนอกเครื่องและทดสอบกู้คืนสำเร็จจริง');
  add('maintenance', 'การเปิดเว็บลูกค้า', env.LAUNCH_MAINTENANCE !== 'true', env.LAUNCH_MAINTENANCE === 'true' ? 'เว็บยังอยู่ในโหมด maintenance' : 'ยังต้องทดสอบเส้นทางลูกค้าบนเว็บจริง');
  let evidence;try{evidence=JSON.parse(env.CANONICAL_DISPLAY_RIGHTS_JSON||'{}');}catch{evidence={};}
  // Configuration evidence only; legacy boolean flags cannot certify a license.
  const providers={thai:['settrade','yahoo'],dr:['settrade','yahoo'],us:['fmp','yahoo'],tfex:['settrade'],forex:['owner-ingest']};
  for(const [market,sources] of Object.entries(providers)){
    add(`rights-${market}`,`สิทธิแสดงข้อมูล ${market}`,sources.some(id=>displayRights(evidence,market,id,now)==='CONFIRMED'),
      'ตรวจ canonical evidence ที่ยังไม่หมดอายุ; ต้องตรวจเอกสารจริงและสิทธิ์ของทุกแหล่งที่จะใช้ก่อนเปิดบริการ');
  }
  if (env.MARKETDX_API_KEY) add('rights-news', 'สิทธิแสดงข่าว', env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิแสดงข่าวแก่ลูกค้า');
  if (env.FRED_API_KEY) add('rights-macro', 'สิทธิแสดงข้อมูลเศรษฐกิจ', env.FRED_PUBLIC_DISPLAY_RIGHTS_CONFIRMED === 'true', 'ต้องยืนยันสิทธิแสดงชุดข้อมูลเศรษฐกิจ');
  if (env.FOREX_MT5_ENABLED === 'true') {
    const forex = customerPreflight(env);
    add('forex-receiver', 'การรับข้อมูล MT5 ของเจ้าของ', forex.configuration_ready,
      forex.configuration_ready ? 'ตั้งค่า Node, HTTPS และฐานข้อมูล MT5 ถาวรแล้ว ยังต้องทดสอบ Terminal จริง' : `ยังไม่ผ่าน: ${forex.remaining.join(', ')}`);
    add('forex-backup', 'สำรองและกู้คืนข้อมูล MT5', backupKey && env.FOREX_MT5_BACKUP_RECOVERY_CONFIRMED === 'true',
      'ฐาน MT5 แยกจากฐานสมาชิก ต้องสำรองนอกเครื่องและทดสอบกู้คืนแยกก่อนยืนยัน FOREX_MT5_BACKUP_RECOVERY_CONFIRMED');
  }
  return { checks, publicOrigin: publicHttps ? origin.origin : null };
}
