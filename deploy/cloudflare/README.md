# Cloudflare — แอป Nugaom เดิม

เป้าหมาย: เว็บบน Workers, สแกนทุก 5 นาทีด้วย Cron/Queues และเก็บสมาชิก/สัญญาณใน D1 ไม่ต้องมี VPS หรือ Supabase

## ขั้นที่ 1: ฐานข้อมูล

- สมาชิก LINE, session/OAuth, พอร์ต, เครดิต/คำถาม AI, หุ้นโปรด, สัญญาณ, ความคืบหน้าสแกน, แท่งราคา และผลย้อนหลัง ใช้ repository แบบ async ร่วมกัน
- SQLite เดิมยังเป็นตัวหลักจนกว่าการย้าย remote และตรวจเทียบจะครบ ไม่มี silent fallback เมื่อเลือก D1
- โค้ดรายเดือน/การอนุมัติต่ออายุใช้ version และ atomic batch เพื่อไม่ต่ออายุซ้ำเมื่อมีคำขอพร้อมกัน
- AI ฟรี 5 คำถาม/วันตามเวลาไทย จากนั้น 1 เครดิต/คำถาม จอง/คืนเครดิตในฐานข้อมูล ใช้ reservation token ป้องกันคำขอเก่าทับคำขอใหม่
- ราคาเข้า–ออกครั้งแรกถูกเก็บไว้ เหตุการณ์สัญญาณแก้ไข/ลบไม่ได้ งานตรวจราคาที่อ่านสถานะเก่าไม่สามารถทับสถานะใหม่
- หุ้นโปรดเก็บตามบัญชี LINE มีการตรวจสิทธิ์/origin ข้อมูล guest นำเข้าครั้งเดียวแล้วนำออกจาก browser เพื่อไม่คัดลอกไปบัญชีถัดไป
- แท่งราคาเดิมที่ไม่เปลี่ยนไม่ถูกเขียนซ้ำทุกครั้งที่สแกน
- 0001 เป็น baseline เดิม, 0002 เพิ่ม atomic writes/หุ้นโปรด, 0003 ป้องกันการหักเครดิตซ้ำเมื่อนำเข้าคำตอบ AI เก่า

## สถานะ ณ 7 ต.ค. 2026

สร้าง nugaom-prod-db ใน APAC และลง schema ครบ 3 migration แล้ว

สำเนา D1 ในเครื่องตรวจจำนวนแถวและ SHA-256 ตรงกับ snapshot ทุกตาราง พร้อมตรวจ foreign keys/integrity: สัญญาณ 276, เหตุการณ์ 598, แท่งราคา 397,943 (ตัวเลขของ snapshot เปลี่ยนได้ระหว่างสแกน)

บัญชีเป็น Workers Free ขณะตรวจ และยืนยัน OAuth ใหม่พร้อมอ่าน native remote D1 สำเร็จแล้ว ปลายทางยังไม่มีข้อมูลสมาชิกหรือแท่งราคา แอปยังใช้ SQLite เดิม ขั้นนี้ยังไม่ได้ deploy เว็บหรือเปิด Cron production

ไม่จำเป็นต้องอัปเกรดเพียงเพราะประวัติเดิมเกือบ 400,000 แถว: นี่เป็นการย้ายครั้งแรก ไม่ใช่ยอดเขียนรายวัน ต้องจัดรอบย้ายหลายวันภายใต้งบโควตา หรือเลือก Paid หากต้องการย้ายทั้งหมดในรอบเดียว ยังไม่มีการเปลี่ยนแพ็กเกจ

## ประเมินโควตา Free ก่อนย้าย

- D1 Free เขียน 100,000 แถว/วัน อ่าน 5 ล้านแถว/วัน รวมการใช้งานฐานข้อมูลอื่นในบัญชี และ index มีต้นทุนเขียนเพิ่ม ตัวเลขนี้ไม่ใช่จำนวนรอบสแกนหรือจำนวนสมาชิก
- Cron ทุก 5 นาทีมี 288 รอบ/วัน งานสแกนชุดเดียวใช้ร่วมกันสำหรับลูกค้า ไม่ควรเปิด scanner แยกต่อสมาชิก
- ชุดสแกนปัจจุบัน: ไทย 150, DR 141, US 500 ตัว US ใช้รายวันหลังตลาดปิด ยังไม่ใช่การสแกน intraday ทั้ง 500 ตัวทุก 5 นาที
- จาก archive ในเครื่อง วันที่ 1, 2, 5, 6 ต.ค. มีแท่ง 15m ตามวันที่ UTC ประมาณ 4,724–6,042 แท่ง/วัน และแท่งรายวัน 731–778 แท่ง/วัน จำนวนนี้เป็นแท่งที่เก็บ ไม่ใช่ค่าการเขียน D1 จริง: การอัปเดตแท่งเดิม สถานะสแกน เหตุการณ์ และ index ต้องนับเพิ่ม
- archive เปรียบเทียบเฉพาะ timestamp ที่ฟีดส่งกลับผ่าน primary key ไม่อ่านประวัติทั้งสินทรัพย์ทุกครั้ง และเขียนเฉพาะแท่งใหม่/เปลี่ยน ยังคงตรวจการแก้ไขแท่งย้อนหลังในช่วงที่ขอไว้
- Free เป็นทางเริ่มต้นที่เป็นไปได้ แต่ต้องวัด rows_read/rows_written จริงเมื่อรันบน Workers พร้อมโหลดลูกค้า ตั้งงบงานย้าย/ประวัติให้เหลือพื้นที่สำหรับ login และสัญญาณ ห้ามใช้โควตาจนหมดเพื่อเร่งย้าย
- เครื่องมือ d1:import ปัจจุบันยังนำเข้าทั้ง snapshot ไม่ใช่ตัวนำเข้าหลายวัน ห้ามรัน full import บน Free กับ snapshot นี้ ต้องทำ checkpoint/resume และตรวจเทียบครบก่อนสลับฐานข้อมูล
- การย้ายเกือบ 400,000 candle rows ต้องเผื่อ index ของ primary key ด้วย จึงไม่ควรคิดว่าใช้โควตาเพียง 4 วัน ไม่มีการลบประวัติเดิมเพื่อให้ย้ายเร็วขึ้น
- ข้อจำกัด Workers CPU, จำนวน query ต่องาน และฟีดตลาดต้องประเมินแยกจาก D1 งาน Cron/Queues ยังอยู่ในขั้นเตรียม หาก Free ไม่พอให้ตัดสินจากตัวเลขจริงของแต่ละข้อจำกัด

## โหมดฐานข้อมูล

- STORAGE_PROVIDER=sqlite (default): SQLite เดิม
- STORAGE_PROVIDER=d1-local: native D1 จำลองด้วย Wrangler เก็บใน deploy/cloudflare/.wrangler/state/v3
- STORAGE_PROVIDER=d1-remote: native D1 ผ่าน official Wrangler development bridge ต้องมี OAuth ที่ใช้ได้ ใช้เปลี่ยนผ่านจากเว็บ Node ในเครื่อง
- STORAGE_PROVIDER=d1: Worker ส่ง binding จริง env.DB เข้า withD1Database ครอบ request/job ถ้าไม่มี binding ให้แจ้ง unavailable
- D1_CONFIG_PATH: เปลี่ยน path config เมื่อจำเป็น

Development bridge ไม่ใช่การ deploy Workers เมื่อเว็บขึ้น Workers ให้ใช้ binding โดยตรง ห้ามส่ง OAuth ของ Wrangler ไปให้ลูกค้าหรือใส่ใน Git

สิทธิ์ Wrangler ที่ใช้ในขั้นนี้: account:read, user:read, d1:write, workers_scripts:write และ offline_access ที่เพิ่มอัตโนมัติ สิทธิ์ workers:write แบบเดิมไม่พอสำหรับ preview subdomain API ในบัญชีนี้

## ย้ายข้อมูลหลังบัญชีพร้อม

ใช้ Node รันไฟล์ .mjs ปกติ หลีกเลี่ยง --input-type=module ซึ่งรบกวน Worker threads ของ Miniflare

1. หยุด web และ scanner ทุกตัวชั่วคราว รอ AI ที่กำลังตอบให้จบ
2. รัน npm run d1:schema:remote ตาม config ของเจ้าของ
3. ตั้ง D1_MIGRATION_DIR เป็นโฟลเดอร์ส่วนตัวใหม่ เช่น data/d1-migration/cutover-20261007 ใช้ค่าเดียวกันทุกคำสั่งในรอบ
4. npm run d1:prepare: สำรองเข้ารหัส, snapshot SQLite ที่สอดคล้องกัน, SQL ระบุคอลัมน์/แบ่งคำสั่งไม่เกิน 64 KB, manifest จำนวนแถวและ hash
5. npm run d1:import: ปฏิเสธปลายทางที่มีข้อมูล นำเข้าแล้ว export กลับมาตรวจเทียบทุกตาราง ไม่มี customer payload ออก stdout
6. npm run d1:unchanged: ต้องตรงกับ snapshot และยังไม่มี writer ทำงาน ถ้าไม่ตรงห้ามสลับ ต้องเตรียมรอบใหม่พร้อมปลายทางที่วางแผนไว้
7. หลัง verified/unchanged จึงตั้ง .env.local เป็น STORAGE_PROVIDER=d1-remote และ D1_CONFIG_PATH=deploy/cloudflare/wrangler.remote.jsonc แล้วเปิด web/scanner
8. ตรวจ health, บัญชี/สิทธิ์, หุ้นโปรด, พอร์ต, ผลสัญญาณ รักษา SESSION_SECRET/PORTFOLIO_HASH_SECRET เดิมเพื่อให้ session/hash ใช้ต่อได้

ข้อมูล snapshot/export/raw SQL อยู่ใน data/ permission ส่วนตัวและ Git ignore หลัง remote มีการเขียนใหม่ ห้ามชี้กลับ SQLite เก่าโดยไม่ย้ายธุรกรรมหลังสลับ

d1:verify ใช้ตรวจ export ซ้ำ ต้องย้าย comparison เดิมไว้ก่อนหรือใช้โฟลเดอร์ตรวจใหม่พร้อม manifest; script ปฏิเสธการเขียนทับ comparison เดิม

## ขั้นต่อไปหลังฐานข้อมูล

1. Cron UTC */5 * * * * ส่งงานตลาด/หุ้นย่อยเข้า Queues มี lease/stable event key และ retry/timeout แยกจากหุ้นไม่เข้าเงื่อนไข
2. Worker entry points ใช้ D1 binding จริง ปรับ native Node/SDK/filesystem/Ollama ที่ Workers ไม่รองรับก่อน deploy
3. เว็บ HTTPS ถาวร เก็บ credentials ใน Cloudflare Secrets และลงทะเบียน LINE callback ตรง origin
4. ตรวจ login → สิทธิ์ 14 วัน → สแกนเมื่อไม่มี browser → เสียง/popup → ผลราคาเข้า–ออก เสียงเว็บต้องผ่านการกดอนุญาตของลูกค้า
5. D1 Time Travel, offsite encrypted backup, ตรวจโควตาและสถิติสแกนก่อนรับลูกค้า production

## อ้างอิง

- [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch): atomic writes
- [Import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free อ่าน 5 ล้าน/วัน เขียน 100,000/วัน Query ผ่าน Wrangler ก็นับโควตา
- [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): Free ย้อน 7 วัน, Paid 30 วัน
