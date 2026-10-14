# รีวิว main + community — 14 ตุลาคม 2026

## Git และขอบเขต

origin/main ก่อนรวมอยู่ที่ `21766235400d1d4f582cc953ca632949a2986237` ส่วน main ในเครื่องมี `47d9826` ต่อจาก commit นี้โดยตรง จึงเป็นการ fast-forward รวม robot landing, scanner repairs, membership/coach และ community ใหม่ ไม่ได้ import branch community เก่าที่เข้าถึงไม่ได้

รีวิว source ที่เปลี่ยน, permission/idempotency/notification, SQLite/D1 migration และหลักฐาน runtime/build ไม่ได้ตรวจภาพ browser หรือใช้อุปกรณ์จริงตามข้อจำกัด automation เดิม ไม่มี credential/launch flag เปลี่ยน ไม่มี deploy หรือ apply migration บน D1 จริง

## Findings และการแก้

- **P2 — ยืนยัน send ที่บันทึกแล้วหลัง lock/close ไม่ได้**: `mutateCommunity` ตรวจสถานะห้อง/หัวข้อก่อนตรวจ operation replay หากคำตอบของ send หลุด แล้วแอดมินล็อกห้อง/ปิดเรื่อง retry จะตอบ ROOM_LOCKED/THREAD_CLOSED แทนยืนยันผลเดิม ย้าย lock/close ไปหลัง replay โดยยังตรวจสิทธิ actor/channel ก่อน replay และ SQL ยังปฏิเสธ write ใหม่ในช่องที่ปิดแล้ว Regression ทำซ้ำทั้ง SQLite และ native D1; จำนวนข้อความไม่เพิ่ม
- **P2 — แจ้งข้อความใหม่จากยอด unread รวมอาจพลาด**: การอ่านบางห้องพร้อมกับข้อความใหม่อีกห้องทำให้ยอดรวมคงที่หรือลดลง จึงไม่แจ้ง เพิ่ม incomingCursor จากลำดับข้อความที่สมาชิกมีสิทธิเห็น โดยตัดข้อความของตนเองและข้อความซ่อน แยกขอบเขต own inbox/member rooms กับ team inbox ใช้ baseline ที่ไม่ถอยหลังและไม่ขึ้นกับ pagination/receipt ไม่ส่ง metadata ของ inbox ต่างทีม Regression ครอบคลุม scope และ detector

หลังการแก้ยังต้องทดสอบ UI ด้วยบัญชี LINE จริงและมือถือ การผ่าน unit/integration ไม่ใช่หลักฐานว่าภาพ layout หรือ interaction ใน browser ผ่านครบ ไม่มีการอ้างว่าตรวจพบทุก bug

## ผลตรวจล่าสุด

- ชุดทดสอบรวม **88/88 ผ่าน**: membership, daily AI quota/credits, scanner lifecycle/catch-up, security, coach paper accounting, community permissions/retry/cursor, native local D1, encrypted recovery และ cutover fixture
- Next build แบบแยก `.next-review` ผ่าน และ `npm run cloud:build` ผ่าน
- root ในเครื่อง HTTP 200 มี robot hero ไม่มี iframe
- ตัวอย่าง Settrade PTT 15m: 360 แท่ง, DR AAPL80 15m: 730 แท่ง, TFEX S50Z26 15m: 375 แท่ง ล่าสุดวันที่ 14 ต.ค. คืน HTTP 200 ฟีดที่เคยตอบ 503 ฟื้นในรอบตรวจนี้
- NVDA D1 คืน 300 แท่งจาก FMP EOD ล่าสุด 13 ต.ค.; EUR/USD 1h คืน 5,000 แท่งจาก Yahoo historical ล่าสุด 14 ต.ค. ไม่ใช่การรับรอง coverage ทุก symbol หรือ broker bid/ask
- local health storage available, worker running แต่ตลาดไทย candidate-degraded และ US degraded ขณะตรวจ coverage ไทย done 46/150 ค้าง 104, DR done 30 และ ineligible 2/141 ค้าง 109, US done 499/500 ค้าง 1 เป็น snapshot ที่เปลี่ยนต่อได้ ไม่ใช่ผลทุกวันหรือหลักฐาน full-market success
- catalog มีหุ้นไทย 150, DR 141, TFEX 10 สัญญา, US/ETF รวม 600, Forex 19 เครื่องมือ AutoPick US ใช้ 500 ตัวและรายวัน TFEX/Forex AutoPick ยัง blocked ไม่ครอบคลุมหุ้นไทยทั้งตลาด
- Cloud check ผ่าน private review endpoints; public ยัง HTTP 503 maintenance และ scanner offline การตอบ HTTP 200 ผ่าน review ไม่ใช่การเปิดบริการลูกค้า
- production preflight ในเครื่องยัง blocked HTTPS callback, permanent storage, offsite restore และสิทธิแสดงข้อมูลที่ใช้ ไม่ใช้การตั้งค่า local แทนหลักฐาน config ของ Worker

## พร้อมในขอบเขตใด

| ส่วน | ขอบเขตที่ตรวจแล้ว | ยังต้องทำก่อนเปิดลูกค้า |
| --- | --- | --- |
| Robot landing/แยกตลาด | build + HTTP/source ผ่าน | ตรวจ browser/mobile และ fallback จริง |
| กราฟ/ข้อมูล | ตัวอย่างทั้งห้าตลาดคืนข้อมูลในเครื่อง | ตรวจทุก symbol/timeframe, freshness/สิทธิแสดงข้อมูล |
| LINE สมาชิก ทดลอง/ต่ออายุ/เครดิต | transactional tests SQLite/D1 ผ่าน | hosted consent และเส้นทางบัญชีจริง |
| AutoPick ไทย/DR/US | lifecycle, immutable events, inbox/เสียง adapter ผ่าน tests | coverage ยังไม่ครบ; cloud offline; reload/เสียงอุปกรณ์จริง |
| ผลสัญญาณ | source ใช้ last 100 closed trades จากราคาแท่ง | ไม่ใช่ broker fills หรือผลการเทรดลูกค้า |
| พอร์ตโค้ช | paper accounting/permissions/pagination ผ่าน | ลองเข้า/ปิดด้วยบัญชีโค้ชจริง; คงป้าย Paper Trade |
| Community/ทีม | backend, current rights, inbox isolation, migration/restore ผ่าน | LINE/UI/retry จริงบนมือถือ; แต่งตั้งทีมจริง; apply 0008 ก่อน cloud deploy |
| Production | packaging พร้อม | hosting plan/limits, provider rights, fresh customer cutover, offsite recovery, hosted LINE/device checks และเปิด scanner ตามหลักฐาน |

การอัปเดต main บน GitHub เป็นการรวม source เท่านั้น ไม่เปิดเว็บสาธารณะหรือ cloud scanner

## ต่อจากรีวิว

แก้รายการค้างและปิดสถานะ coverage เพิ่มแล้ว ดู `docs/autopick-coverage-repair-2026-10-14.md` สำหรับสถานะที่แยก missed/unavailable, migration 0009, worker reload และหลักฐานใหม่ ชุดรวมล่าสุดผ่าน 100 tests/subtests ข้อมูลรอบสแกนในตารางเดิมด้านบนเป็น snapshot ก่อนการแก้ครั้งนี้

ตรวจเส้นทาง Community ต่อแล้ว: แก้ lost confirmation + rate limit ที่อาจส่งซ้ำ, คำขอค้าง และการส่งซ้อน ชุดล่าสุดผ่าน **111 tests/subtests** พร้อม Next/Cloud build ดู `docs/community-flow-verification-2026-10-14.md` การตรวจด้วย LINE/มือถือจริงยังเป็นงานค้างก่อนเปิดลูกค้า
