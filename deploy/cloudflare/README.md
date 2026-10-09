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
- 0001 เป็น baseline เดิม, 0002 เพิ่ม atomic writes/หุ้นโปรด, 0003 ป้องกันการหักเครดิตซ้ำเมื่อนำเข้าคำตอบ AI เก่า, 0004 เพิ่มงานหลังบ้าน, 0005 เพิ่มคิวงานและแคชราคา, 0006 ให้การติดตามสัญญาณมาก่อนการคัดหุ้นใหม่

## สถานะ ณ 9 ต.ค. 2026

เว็บ HTTPS deploy แล้วที่ https://nugaom-ai-pick.nuibhr1.workers.dev ใช้ D1 binding จริง สร้าง nugaom-prod-db ใน APAC และลง schema ครบ 6 migration แล้ว

สำเนา D1 ในเครื่องก่อน migration 0004 ตรวจจำนวนแถวและ SHA-256 ตรงกับ snapshot ทุกตาราง พร้อมตรวจ foreign keys/integrity: สัญญาณ 276, เหตุการณ์ 598, แท่งราคา 397,943 (ตัวเลขของ snapshot เปลี่ยนได้ระหว่างสแกน) หลังเพิ่มงานหลังบ้าน ต้องเตรียม snapshot ใหม่ก่อนย้ายจริงเพราะ schema/manifest เปลี่ยน

เว็บ cloud อยู่โหมด maintenance; scanner deploy แล้วพร้อม Cron ทุก 5 นาทีและ Queues/DLQ แต่ SCANNER_ENABLED=false จึงยังไม่สแกนตลาดจริง ปลายทางยังไม่มีข้อมูลสมาชิก/ประวัติจากเครื่อง แอป local ยังใช้ SQLite เดิม ไม่มีการตัดสลับฐานข้อมูล

ยังไม่ได้เปลี่ยนแพ็กเกจหรือยืนยันว่าบัญชีอัปเกรดแล้ว การวัด Worker ก่อนหน้านี้พบ warm HTTP CPU 18–47 ms เกินเพดาน Free 10 ms แม้ requests ยังสำเร็จเพราะ Cloudflare ยอมให้เกินชั่วคราว จึงควรใช้ Paid ก่อนเปิดลูกค้าจริง ประวัติราว 398,000 แถวเป็นการย้ายครั้งแรก ไม่ใช่ยอดเขียนรายวัน

ตรวจ build, schema และ HTTP เว็บ cloud สำเร็จ /api/account แจ้ง configured=true และ guest เข้า admin ไม่ได้ แต่ยังไม่รับรอง LINE consent บนโดเมนจริงหรือเสียงบนเครื่องลูกค้า รายการตรวจ native D1 ใช้ข้อมูล fixture แยกจากฐานลูกค้า: profile/session, trial 14 วันไม่รีเซ็ต, โค้ดรายเดือนและต่ออายุไม่ซ้ำ, AI ฟรี 5 ครั้ง/วันและคืนเครดิตเมื่อคำตอบสะดุด, ราคาเข้า–ออกและเหตุการณ์ entry ไม่ซ้ำ

คีย์อยู่ Cloudflare Secrets ไม่มี Webull และไม่มีคีย์จริงใน bundle ที่ตรวจ .env.local ไม่ถูกแก้ไขระหว่าง deploy

ก่อนเปิด public ยังต้อง: ยืนยัน Paid, ย้าย snapshot ขณะพัก writers และตรวจเทียบ, ยืนยันสิทธิแสดงข้อมูลแต่ละแหล่งตาม production gates, ลง callback HTTPS และเปิด LINE channel สำหรับลูกค้า, เปิด scanner และตรวจ provider/coverage จริง แล้วจึงปิด maintenance ปัจจุบันไม่ได้ตั้ง *_DISPLAY_RIGHTS_CONFIRMED หรือ BACKUP_RECOVERY_CONFIRMED ให้เอง

## คำสั่ง release ของแอปเดิม

- npm run cloud:build — build ใน data/cloud-build/app โดยไม่ใช้ .env.local หรือแตะ preview เดิม
- npm run cloud:deploy:web — deploy bundle ปัจจุบัน โดยคง maintenance ตาม config
- npm run cloud:deploy:scanner — deploy Cron/Queues โดยคง SCANNER_ENABLED ตาม config
- npm run cloud:secrets:web / cloud:secrets:scanner — ส่งเฉพาะ whitelist ผ่าน stdin ไม่ echo ค่า
- npm run cloud:check — อ่าน health/หน้า/API และตรวจ guest admin denial; ไม่สร้าง OAuth flow
- node --test src/membership/cloud-storage.test.mjs — ตรวจสมาชิกและ ledger บน native D1 จำลองส่วนตัว ไม่ใช้ข้อมูลจริง

data/cloud-launch/review.key เป็นคีย์ตรวจช่วง maintenance สำหรับ header x-nugaom-launch-review เท่านั้น ห้ามใส่ใน URL, Git หรือส่งให้ลูกค้า

## ประเมินโควตา Free ก่อนย้าย

- D1 Free เขียน 100,000 แถว/วัน อ่าน 5 ล้านแถว/วัน รวมการใช้งานฐานข้อมูลอื่นในบัญชี และ index มีต้นทุนเขียนเพิ่ม ตัวเลขนี้ไม่ใช่จำนวนรอบสแกนหรือจำนวนสมาชิก
- Cron ทุก 5 นาทีมี 288 รอบ/วัน งานสแกนชุดเดียวใช้ร่วมกันสำหรับลูกค้า ไม่ควรเปิด scanner แยกต่อสมาชิก
- ชุดสแกนปัจจุบัน: ไทย 150, DR 141, US 500 ตัว US ใช้รายวันหลังตลาดปิด ยังไม่ใช่การสแกน intraday ทั้ง 500 ตัวทุก 5 นาที
- จาก archive ในเครื่อง วันที่ 1, 2, 5, 6 ต.ค. มีแท่ง 15m ตามวันที่ UTC ประมาณ 4,724–6,042 แท่ง/วัน และแท่งรายวัน 731–778 แท่ง/วัน จำนวนนี้เป็นแท่งที่เก็บ ไม่ใช่ค่าการเขียน D1 จริง: การอัปเดตแท่งเดิม สถานะสแกน เหตุการณ์ และ index ต้องนับเพิ่ม
- archive เปรียบเทียบเฉพาะ timestamp ที่ฟีดส่งกลับผ่าน primary key ไม่อ่านประวัติทั้งสินทรัพย์ทุกครั้ง และเขียนเฉพาะแท่งใหม่/เปลี่ยน ยังคงตรวจการแก้ไขแท่งย้อนหลังในช่วงที่ขอไว้
- Free เป็นทางเริ่มต้นที่เป็นไปได้ แต่ต้องวัด rows_read/rows_written จริงเมื่อรันบน Workers พร้อมโหลดลูกค้า ตั้งงบงานย้าย/ประวัติให้เหลือพื้นที่สำหรับ login และสัญญาณ ห้ามใช้โควตาจนหมดเพื่อเร่งย้าย
- เครื่องมือ d1:import ปัจจุบันยังนำเข้าทั้ง snapshot ไม่ใช่ตัวนำเข้าหลายวัน ถ้า remote เกิน 25,000 แถวจะปฏิเสธจนกว่าจะยืนยัน D1_PAID_PLAN_CONFIRMED=true หลังตรวจ billing จริง ห้ามใช้ flag นี้เพียงเพื่อข้ามข้อจำกัด
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

1. Cron UTC */5 * * * * ส่งงานชุดละ 4 ตัวเข้า Queues มี lease/retry/coalescing หนึ่งงานต่อ symbol ต่อ session, priority ของสัญญาณติดตามก่อนงานใหม่, ยกเลิกงาน session เก่าและเก็บงานจบ 7 วัน สัญญาณ/ผลงานไม่ถูกลบตามงานคิว
2. Worker entry points ใช้ D1 binding จริง แคช US history ใน D1 ไม่พึ่ง filesystem และปิดการรัน Webull/Python ใน cloud
3. เว็บ HTTPS ถาวร เก็บ credentials ใน Cloudflare Secrets และลงทะเบียน LINE callback ตรง origin
4. ตรวจ login → สิทธิ์ 14 วัน → สแกนเมื่อไม่มี browser → เสียง/popup → ผลราคาเข้า–ออก เสียงเว็บต้องผ่านการกดอนุญาตของลูกค้า
5. D1 Time Travel, offsite encrypted backup, ตรวจโควตาและสถิติสแกนก่อนรับลูกค้า production

## หลังบ้านผู้ดูแล

เปิด /admin ด้วย LINE ที่อยู่ใน ADMIN_LINE_IDS มีภาพรวม สมาชิกทั้งหมด/ค้นหา/แบ่งหน้า ตรวจพอร์ต ต่ออายุ เครดิต ออก/ยกเลิกโค้ด ผลสัญญาณทีละ 7 รายการ และประวัติผู้ทำรายการ ดูคู่มือ [หลังบ้าน](../admin-operations.md)

หน้าแสดงความพร้อมไม่ถือว่า OAuth Wrangler สำเร็จแล้วเว็บเปิดรับลูกค้าได้: local/dev bridge ยังไม่ใช่เว็บถาวร และการยืนยัน backup recovery ต้องทำจริงก่อนตั้ง BACKUP_RECOVERY_CONFIRMED=true

## พอร์ตจำลองของโค้ช

Migration 0007 เพิ่มพอร์ตโค้ชที่แอดมินมอบหมายให้สมาชิก LINE บันทึกเข้า–ออกด้วยมือ หน้าลูกค้าดูเฉพาะพอร์ตที่แอดมินเผยแพร่ แยกจากผล AutoPick และยังไม่เชื่อม MT5 ดู [คู่มือพอร์ตโค้ช](../../docs/coach-portfolios.md)

## MT5 เป็นส่วนเสริม

ลูกค้าที่ใช้สแกน/กราฟ/ผลงาน/เสียงบนเว็บไม่ต้องติดตั้ง MT5 หรือเปิดคอม ส่วน EA Dashboard ของบัญชีลูกค้ายังไม่ได้เปิดบริการ ตัวเชื่อมและการส่งข้อมูลจริงยังไม่ถูกสร้างใน release นี้

แนวทางต่อยอด: ลูกค้าติดตั้งตัวส่งข้อมูลและจับคู่บัญชีด้วยรหัสใช้ครั้งเดียวบน LINE account; HTTPS ingest รับ snapshot แบบอ่านอย่างเดียวและแสดงเวลาอัปเดต/ขาดการเชื่อมต่อ ระบบนี้ไม่มีการส่งคำสั่งซื้อขาย ต้องแยกความยินยอมและข้อมูลบัญชีส่วนบุคคลจากราคากลาง ไม่มี broker password อยู่ใน dashboard หลังบ้าน หากลูกค้าปิด Terminal ต้องแสดงข้อมูลค้างให้ชัดเจนและไม่สร้างสัญญาณใหม่จากฟีดนั้น Cloudflare เป็นเว็บ/ที่รับข้อมูล ส่วน Terminal อยู่บนเครื่องลูกค้าหรือ VPS; ดู [MT5 bridge](../../docs/mt5-forex-bridge.md)

## อ้างอิง

- [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch): atomic writes
- [Import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): Free อ่าน 5 ล้าน/วัน เขียน 100,000/วัน Query ผ่าน Wrangler ก็นับโควตา
- [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): Free ย้อน 7 วัน, Paid 30 วัน
