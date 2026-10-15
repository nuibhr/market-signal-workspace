# ตรวจแอปก่อนเฟส community — 14 ตุลาคม 2026

ตรวจ repository เดิม `market-signal-workspace` บน main ฐาน commit `2176623` พร้อมการแก้ landing ในเครื่องจากวันที่ 13 ตุลาคม ไม่มีการ deploy หรือเปลี่ยน credential/launch flags ในรอบนี้

## สิ่งที่พบและแก้

1. หลังบ้านประเมินความพร้อมเปิดลูกค้าจาก 5 รายการและไม่ได้ตรวจสิทธิข้อมูล ใช้ `launchConfiguration` ร่วมกับ preflight แล้ว เพิ่มการตรวจคีย์ session ที่แยกกัน, LINE IDs, การกู้คืน backup ที่ต้องมีคีย์เข้ารหัส, maintenance และสิทธิข้อมูลตามเส้นทางที่เปิดให้ใช้ กราฟ/quote มีสิทธิแยกจาก AutoPick ผลพร้อมเป็นเพียงหลักฐานการตั้งค่า ไม่ใช่การตรวจลูกค้าจริง
2. Settrade/TFEX ตอบ HTTP 503 จาก login แต่ client เรียกเป็น `AUTH_FAILED` ทั้งหมด แก้ให้ HTTP 429 เป็น `RATE_LIMITED`, 5xx เป็น `SOURCE_UNAVAILABLE` และคงรหัสปฏิเสธ auth สำหรับ 4xx เดิม ไม่อ่านหรือส่ง error body ของผู้ให้บริการ การเปลี่ยนนี้ไม่ได้ทำให้บริการต้นทางฟื้นและไม่ได้พิสูจน์ว่าคีย์ใช้ได้
3. เพิ่ม regression ของพอร์ตโค้ชบน SQLite และ native local D1: เจ้าของ/ผู้ดูแล, พอร์ตที่ซ่อน, การกดซ้ำ, operation conflict, ค่าธรรมเนียม/ยอดเงิน, ชนะและแพ้, ประวัติ 7 แถว, ไม่เผยข้อมูลส่วนตัว และพักพอร์ตโดยไม่ลบประวัติ ใช้ข้อมูล fixture ในฐานข้อมูลชั่วคราวเท่านั้น

## หลักฐานตรวจปัจจุบัน

- ชุดทดสอบรวม 62/62 ผ่าน ครอบคลุม AutoPick, สมาชิก, security, market adapters, launch configuration และพอร์ตโค้ช
- Next build แบบแยก `.next-review` และ Cloud packaging ผ่านหลังการแก้ทั้งหมด; ตรวจ diff whitespace ผ่าน ไม่มีการ deploy
- หน้า `/`, `/markets`, `/thai`, `/dr`, `/us`, `/tfex`, `/forex`, `/account`, `/coach`, `/coaches` ตอบ HTTP 200 ใน dev server เดิมที่ 127.0.0.1:3000
- local health: storage available, scanner heartbeat running; นี่ไม่ใช่หลักฐานว่าสแกนทุกตลาดสำเร็จ
- anonymous `/api/admin/system` และ `/api/auto-pick/events` เป็น 403, private/no-store
- เรียกตัวอย่าง PTT/AAPL80 15m และ S50Z26 15m: ข้อมูลไม่พร้อม; login ปลายทางตอบ 503
- NVDA D1 คืน 300 แท่งจาก FMP EOD; EUR/USD 1h คืน 5,000 แท่งจาก Yahoo historical ทั้งสองมีแท่งล่าสุดวันที่ 13 ตุลาคม ตัวอย่างนี้ไม่รับรอง coverage ทั้ง universe และ Forex ไม่ใช่ broker bid/ask
- `npm run cloud:check` ผ่านเส้นทาง read-only ผ่าน review header, LINE configuration true; cloud health scanner offline และ public `/thai` ยัง maintenance HTTP 503 ไม่ใช่การตรวจ production ด้วยโค้ดแก้ใหม่
- การตรวจภาพ browser/mobile, LINE consent จริงและเสียงบนอุปกรณ์ยังไม่ทำ ไม่หลบข้อจำกัด browser automation เดิม

## ขาดก่อนเปิด production

- บริการข้อมูลหุ้นไทย/DR/TFEX ต้องกลับมารับคำขอสำเร็จ และตรวจ coverage/ความสดจริง
- ยืนยันสิทธิแสดงข้อมูล Settrade, TFEX, US EOD, FMP quote, Yahoo history, ข่าวและข้อมูลเศรษฐกิจตาม provider ที่ใช้ โดยไม่ตั้ง flag เองจากการตรวจครั้งนี้
- การตั้งค่าในเครื่องยังเป็น local HTTPS callback/storage ไม่ใช่หลักฐานการตั้งค่า cloud deployment
- ยืนยัน hosting plan/limits, ย้าย snapshot ลูกค้าขณะพัก writers และตรวจเทียบ SQLite/D1, สำรองนอกเครื่องพร้อมหลักฐาน restore
- hosted LINE consent และการทดสอบ notification/reload/เสียงบนเครื่องจริง
- cloud scanner ยังปิดและเว็บยัง maintenance; ไม่มีการซื้อบริการหรือเปิด flag

## Community ยังขาดซอร์ส

origin มีเพียง main; ไม่พบ `feat/community-sylva-landing` การอ่านแชท `01a13060-055e-7553-aafa-b9fe01b8f08e` บน durable host ยังเข้าถึงไม่ได้ จึงยังนำเข้า/รวม branch ไม่ได้ และไม่มี migration 0008 ใน repository นี้

มีคำถามถึงผู้ใช้ค้างอยู่ว่าจะทำ community ใหม่ในแอปเดิมตามข้อกำหนด หรือรอ source branch เดิม ไม่ถือว่าตัวเลือกที่แสดงในคำถามเป็นการอนุมัติ และไม่ประกอบซอร์สเดิมจาก log ที่ไม่ครบ

หากนำเข้าซอร์สเดิม: ตรวจ diff และ migration 0008 ก่อน รวมแบบรักษา robot landing, scanner repairs, สิทธิสมาชิกและ migration 0007 หากทำ implementation ใหม่: ใช้ข้อกำหนดใน `docs/team-chat-integration.md` ร่วมกับห้องสมาชิก โดยยืนยันขอบเขตจากผู้ใช้

สิ่งที่ community ต้องตรวจ: session/สิทธิห้อง, บทบาท marketing/analyst/admin, ความเป็นส่วนตัว inbox ระหว่างสมาชิกและทีม, pagination/read receipts, rate/size/origin checks, moderation/reporting, idempotent ส่งข้อความและ audit, SQLite/D1 migrations/backup/cutover, และ UI ที่ไม่อ้างว่าส่งได้ก่อน backend ทำงานจริง ห้ามส่งข้อความให้บุคคลอื่นเพื่อทดสอบโดยไม่ได้รับคำสั่ง

## ต่อจากผลตรวจ

ผู้ใช้เลือกให้ทำ community ใหม่ในแอปเดิมและสั่งทำต่อแล้ว Implementation และหลักฐานอยู่ที่ `docs/community.md` ไม่ได้รอ source branch เดิมและไม่อ้างว่ารวม branch นั้นแล้ว
