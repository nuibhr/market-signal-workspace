import { storage } from '../storage/database.mjs';
import { isConfigured } from '../membership/store.mjs';
import { isAbsolute } from 'node:path';

export async function adminLaunchReadiness(worker){
  let origin,callback;
  try{origin=new URL(process.env.APP_ORIGIN);callback=new URL(process.env.LINE_REDIRECT_URI);}catch{/* Missing public configuration. */}
  const publicHttps=origin?.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
  const callbackMatches=Boolean(publicHttps&&callback?.origin===origin.origin&&callback.pathname==='/api/auth/line/callback'&&!callback.search&&!callback.hash);
  const mode=process.env.STORAGE_PROVIDER||'sqlite',kind=await storage.kind();
  const production=process.env.NODE_ENV==='production';
  const permanentStorage=production&&(mode==='d1'||mode==='sqlite'&&isAbsolute(process.env.DATABASE_PATH||'')&&process.env.AUTO_PICK_PERSISTENT_SERVER_CONFIRMED==='true');
  const backupKeyReady=/^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY||'');
  const backupRecovered=backupKeyReady&&process.env.BACKUP_RECOVERY_CONFIRMED==='true';
  const checks=[
    {id:'public-web',label:'เว็บสำหรับลูกค้า',status:production&&publicHttps?'ready':'blocked',detail:production&&publicHttps?origin.origin:'เว็บนี้ยังทำงานในเครื่อง ต้องขึ้นเว็บ HTTPS ถาวรก่อน'},
    {id:'line',label:'LINE Login',status:isConfigured()&&callbackMatches?'ready':'blocked',detail:callbackMatches?'ตั้งค่า callback ตรงกับเว็บลูกค้าแล้ว':'ล็อกอินในเครื่องได้ แต่ callback สำหรับเว็บลูกค้ายังไม่พร้อม'},
    {id:'storage',label:'ข้อมูลสมาชิกและสัญญาณ',status:permanentStorage?'ready':'blocked',detail:permanentStorage?(kind==='d1'?'ใช้ D1 บน Workers':'ใช้ฐานข้อมูลบนเซิร์ฟเวอร์ถาวร'):mode==='d1-remote'?'เชื่อม D1 แบบพัฒนา ยังไม่ใช่เว็บ production':'ยังใช้ฐานข้อมูลในเครื่อง'},
    {id:'scanner',label:'งานสแกนต่อเนื่อง',status:worker?.status==='running'?(permanentStorage?'ready':'blocked'):'blocked',detail:worker?.status==='running'?(permanentStorage?'ตัวทำงานสแกนติดต่อได้':'สแกนกำลังทำงานในเครื่อง ยังต้องย้ายงานไปทำต่อบนคลาวด์'):'ตัวทำงานสแกนไม่ส่งสถานะภายใน 5 นาที'},
    {id:'backup',label:'ข้อมูลสำรองเข้ารหัส',status:backupRecovered?'ready':backupKeyReady?'configured':'blocked',detail:backupRecovered?'ผู้ดูแลยืนยันการสำรองนอกเครื่องและกู้คืนแล้ว':backupKeyReady?'มีระบบสำรองในเครื่อง แต่ยังไม่ยืนยันการกู้คืนและที่เก็บสำเนานอกเครื่อง':'ยังไม่ได้ตั้งคีย์สำรองเข้ารหัสสำหรับสภาพแวดล้อมนี้'},
  ];
  return {ready:checks.every(check=>check.status==='ready'),environment:production?'production':'local',storage:kind,
    checks,checkedAt:new Date().toISOString(),publicOrigin:publicHttps?origin.origin:null};
}
