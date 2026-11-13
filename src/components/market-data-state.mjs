const membership=new Set(['AUTHENTICATION_REQUIRED','LOGIN_REQUIRED','MEMBERSHIP_REQUIRED']);
const rights=new Set(['DISPLAY_RIGHTS_NOT_CONFIRMED','DISPLAY_RIGHTS_DENIED','DISPLAY_RIGHTS_EXPIRED']);
export function marketDataState({record,error,loading=false}={}) {
 const code=typeof error==='string'?error:error?.code;
 const codes=record?.status?.codes??[];
 if(loading)return {label:'กำลังโหลดข้อมูล',detail:'กำลังอ่านข้อมูลที่บันทึกไว้',kind:'loading'};
 if(rights.has(code)||codes.some(c=>rights.has(c)))return {label:'ยังไม่เปิดแสดงข้อมูล',detail:'แหล่งข้อมูลนี้ยังไม่ผ่านการยืนยันสิทธิ์เผยแพร่ ไม่ต้องอัปเกรดแพ็กเกจเพื่อแก้สถานะนี้',kind:'rights'};
 if(record?.projection==='REDACTED'||membership.has(code))return {label:'ตรวจสิทธิสมาชิก',detail:'เข้าสู่ระบบหรือเลือกแพ็กเกจเพื่อดูข้อมูลตามสิทธิ',kind:'membership',href:'/account'};
 if(code==='RATE_LIMITED')return {label:'ขอข้อมูลถี่เกินไป',detail:'เว้นช่วงก่อนลองใหม่',kind:'error',retry:true};
 if(code||record?.status?.availability==='UNAVAILABLE')return {label:'ข้อมูลยังไม่พร้อม',detail:'แหล่งข้อมูลยังไม่พร้อมสำหรับรายการนี้ กรุณาลองใหม่ภายหลัง',kind:'error',retry:true};
 if(record?.status?.freshness==='STALE')return {label:'ข้อมูลเก่า',detail:'ใช้เป็นข้อมูลย้อนหลัง ยังไม่ใช้เป็นสัญญาณใหม่',kind:'stale'};
 if(record?.status?.freshness==='UNKNOWN')return {label:'ยังยืนยันความสดไม่ได้',detail:'ตรวจเวลาอ้างอิงก่อนใช้งาน ข้อมูลนี้ยังไม่เป็นสัญญาณ',kind:'unknown'};
 if(record)return {label:record.source?.dataMode==='EOD'?'ราคาปิดรายวัน':'ข้อมูลอ้างอิง',detail:'ข้อมูลตามเวลาอ้างอิง ไม่ใช่การรับรองราคาสด',kind:'available'};
 return {label:'ยังไม่มีข้อมูล',detail:'ยังไม่มีรายการที่แสดงได้ในตลาดนี้',kind:'empty'};
}
export function sourceTime(value){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return 'ต้นทางไม่ระบุ';
 return new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'});
}
