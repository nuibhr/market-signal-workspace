import { storage } from '../storage/database.mjs';
import { isConfigured } from '../membership/store.mjs';
import { launchConfiguration } from './launch-config.mjs';

export async function adminLaunchReadiness(worker) {
  const kind = await storage.kind();
  const production = process.env.NODE_ENV === 'production';
  const { checks, publicOrigin } = launchConfiguration();
  const line = checks.find(check => check.id === 'line');
  if (!isConfigured()) line.status = 'blocked';
  checks.unshift({ id: 'environment', label: 'สภาพแวดล้อมเว็บลูกค้า', status: production ? 'ready' : 'blocked', detail: production ? 'ทำงานใน production' : 'เว็บนี้ยังทำงานในเครื่องสำหรับพัฒนา' });
  checks.push({ id: 'scanner', label: 'งานสแกนต่อเนื่อง', status: production && checks.find(check => check.id === 'storage').status === 'ready' && worker?.status === 'running' ? 'ready' : 'blocked', detail: worker?.status === 'running' ? 'ตัวทำงานติดต่อได้ แต่ต้องยืนยัน storage ถาวรและ production ด้วย' : 'ตัวทำงานสแกนยังไม่พร้อมหรือไม่มีสถานะล่าสุด' });
  return { ready: checks.every(check => check.status === 'ready'), environment: production ? 'production' : 'local', storage: kind, checks, checkedAt: new Date().toISOString(), publicOrigin };
}
