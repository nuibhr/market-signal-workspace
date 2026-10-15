export function summarizeCoverage(c) {
  const accounted=(c.done||0)+(c.ineligible||0)+(c.unavailable||0)+(c.missed||0);
  const label=c.phase==='waiting'||c.phase==='paused'?'รอช่วงสแกน':c.phase==='ended'&&c.remaining>0?'พลาดรอบ · รอปิดสถานะ'
    :c.remaining>0?'กำลังตรวจรายชื่อ':c.missed>0?'ปิดรอบ · มีรายการพลาดตรวจ'
    :c.unavailable>0||c.ineligible>0?'ปิดรอบ · บางตัวข้อมูลไม่พร้อม':'ตรวจและปิดสถานะครบ';
  return {accounted,evaluated:c.done||0,label};
}
