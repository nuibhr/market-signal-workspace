# รีวิวความพร้อมก่อนเปิดให้ลูกค้าจริง — 1 ตุลาคม 2026

## ข้อสรุป

ระบบในเครื่องใช้งานและทดสอบได้ แต่ยังไม่พร้อมเปิดสาธารณะจนกว่าจะมีโดเมน HTTPS, เซิร์ฟเวอร์ที่รันตลอด, ฐานข้อมูลถาวร และยืนยันสิทธิแสดงข้อมูลตลาดจริง ข้อมูลที่เรียกไม่ได้ต้องขึ้น unavailable ห้ามสร้างราคา/คะแนน/ผลกำไรทดแทน

## สิ่งที่แก้ในรอบนี้

| หมวด | ปัญหาที่พบ | สิ่งที่แก้ |
|---|---|---|
| LINE Login | เก็บรายละเอียด OAuth ใน cookie ฝั่งผู้ใช้, ไม่มี timeout เมื่อ LINE ไม่ตอบ | cookie เป็น token สุ่ม; state/nonce/PKCE เก็บใน DB และใช้ครั้งเดียว; ตรวจ expiry/issuer/audience; timeout 10 วินาทีต่อคำขอ |
| Production login | URL/cookie หลัง proxy อาจผิด | production ต้อง HTTPS และ APP_ORIGIN ตรงกับ callback; Secure/HttpOnly/SameSite cookie; ตรวจ Origin ก่อนเขียนข้อมูล |
| API สมาชิก/AI/พอร์ต | จำกัดขนาดเฉพาะ Content-Length จึงรับ payload แบบ chunked เกินขนาดได้ | อ่าน body แบบจำกัด byte จริง; จำกัดคำขอต่อสมาชิกใน SQLite; ข้อผิดพลาดไม่ส่งข้อมูลลับ |
| ฐานข้อมูล | เว็บและ worker เขียน DB เดียวกัน มีโอกาสชน lock | WAL + busy_timeout 5 วินาที; ไฟล์ DB/WAL/SHM permission 0600 |
| Settrade | แต่ละ route สร้าง client/login/cache แยกกัน | shared client ต่อ market, รวมคำขอซ้ำที่กำลังโหลด, cache quote 3 วินาที/intraday 10 วินาที/daily 15 นาที |
| US AutoPick | API บางตัวล้มเหลวแล้วไม่สแกนต่อวันนั้น | บันทึก progress รายตัว, retry คำขอชั่วคราว, เก็บปัญหา PLAN_REQUIRED แยก; สแกนต่อเป็นช่วงงบเวลา 20 วินาที; monitor แผนเดิมก่อนสร้างใหม่ |
| US chart | กราฟกับ scanner เลือกแท่งปิดคนละแบบ | ใช้ FMP daily adapter เดียวกัน; ปฏิเสธแท่งเปิด/วันซ้ำ/OHLC ผิด; รวมคำขอซ้ำและ cache ตาม credential scope |
| สั่ง worker ผ่าน API | เริ่มหลาย promise ก่อนรอ ทำให้ rejection หลุดการจัดการได้ | เรียกแต่ละ market ตามลำดับและจับข้อผิดพลาดแยก |
| ข่าว | API ล้มเหลวแล้วผู้ใช้หลายคนเรียกซ้ำจนใช้ quota | cooldown 60 วินาทีหลังล้มเหลว; เก็บ cache/stale พร้อมสถานะ |
| ความปลอดภัยหน้าเว็บ | ไม่มี headers พื้นฐาน | nosniff, frame deny, referrer policy, CSP object/base/frame; ไม่อ้างว่าเป็น CSP แบบ nonce ครบทุก script |
| สำรองข้อมูล | ยังไม่มี encrypted snapshot | VACUUM INTO snapshot ที่สอดคล้องกับ WAL แล้ว AES-256-GCM; ไฟล์ 0600; เพิ่มคำสั่ง backup และทดสอบ decrypt/integrity |
| ตรวจสถานะ | ไม่มี public health แบบไม่เปิดข้อมูลลูกค้า | /api/health แสดงเฉพาะ storage/scanner; ตรวจละเอียดและ coverage ที่ /api/admin/system ต้อง admin |

## ผลตรวจจริง

- หน้า `/` และ `/account`: HTTP 200
- `/api/membership`: configured=true; anonymous เป็น guest
- `/api/admin/system` เมื่อไม่ล็อกอิน: HTTP 403
- `/api/health`: storage available, scanner running
- MarketDX: HTTP 200, หุ้นไทย 4 ข่าว/หุ้นเมกา 4 ข่าว
- NVDA: HTTP 200, แท่งรายวัน 300 แท่ง, latestDay 2026-09-30 (ตลาดสหรัฐยังไม่ปิดวันที่ 1 ตุลาคมขณะตรวจ)
- หุ้นไทยวันที่ตรวจ: universe 150, done 44, remaining 106 — ยังไม่ใช่หลักฐานว่าสแกนครบวันนั้น ต้องติดตามวันทำการถัดไปที่ worker รันตั้งแต่ก่อนเปิดตลาด
- DR ช่วงตรวจ: universe 141, done 62, remaining 0; ส่วนที่เหลือเป็น ineligible ตามช่วง/ข้อมูลของกติกา ไม่ได้แปลว่ามีสัญญาณครบ 141 ตัว
- US progress schema ใหม่: 101 securities ของ Nasdaq-100 (บริษัทที่มีหลาย share class); ยังต้องตรวจรอบหลังปิดตลาดจริงให้ครบ universe
- production build ผ่าน; ทดสอบ 23 ข้อผ่านทั้งหมด; ชุดทดสอบตลาด/signal/security ใช้ฐานข้อมูลชั่วคราว ไม่เพิ่มสัญญาณจำลองให้ลูกค้า
- กู้คืน encrypted backup ของ DB จริงลง temporary directory และ PRAGMA integrity_check = ok; ไม่เขียนทับ DB ที่ใช้งาน
- เบราว์เซอร์ automation รอบนี้ timeout จึงไม่อ้างว่าตรวจภาพทุกหน้า/มือถือครบ; ผล HTTP ไม่ทดแทนการทดสอบ LINE บนโดเมนจริง

## ช่องว่างของแต่ละหมวด

| หมวด | สถานะที่ควรแจ้งลูกค้า | งานก่อนเปิดเต็มรูปแบบ |
|---|---|---|
| หุ้นไทย/DR | สแกนจากแท่งปิด ไม่ใช่ tick execution; DR ไม่มี bid/ask ยืนยัน | ตรวจ coverage รอบตลาดเต็มวัน, entry/TP/SL/voice จริงและข้อมูลขาดช่วง; ตรวจสิทธิเผยแพร่ |
| US | แผนรายวันหลังตลาดปิด | ตรวจ FMP access ทุก security; หากต้องแจ้งระหว่างวัน ต้องเพิ่ม intraday feed จริง |
| TFEX | ดูกราฟ/quote series Z; AutoPick ยัง blocked | ยืนยันสัญญานำ สภาพคล่อง tick size และความเสี่ยงรายสินค้า ก่อนเปิดสูตร |
| Forex | AutoPick ยัง blocked | จัดหา feed สำหรับ 19 สินค้าและยืนยัน coverage/latency/สิทธิแสดงข้อมูล |
| ข่าว | มีข้อมูลจริง 4 ข่าวต่อประเทศ | สิทธิเผยแพร่ MarketDX, quota และวันเผยแพร่ข่าว |
| ปฏิทิน | FRED เป็น macro/release data | ไม่เรียกว่า news feed หรือปฏิทินทั่วโลกพร้อม consensus/actual; แยกข้อมูลที่ยังขาด |
| AI | Bigdata assistant มีโควตา server side | chart narrative จาก Ollama เป็น local-only; production route ปิดไว้จนมีบริการจริง |
| Backtest | ทดสอบเฉพาะข้อมูลที่มีจริง | ยังไม่รับรองย้อนหลังครบ 3 เดือน/ทุกตัว; แยก replay จากผลสัญญาณที่เข้าออกจริง |
| เสียงแจ้งเตือน | browser speech หลังผู้ใช้เปิดเสียง | แท็บต้องเปิด; background/mobile อาจระงับเสียง; ตรวจอุปกรณ์จริงก่อนรับรอง |
| สมาชิก | LINE + พอร์ต + trial + code/เครดิต | monthly admin code ใช้งานเป็นช่องทางหลัก; subscription payment ยังต้องมี payment webhook/idempotency ก่อนรับเงิน |
| ข้อมูลลูกค้า | แยก member ownership และ portfolio hash | จัดทำ privacy/retention/คำขอลบข้อมูลและกระบวนการ support ก่อนรับลูกค้าสาธารณะ |

## ลำดับ Cloudflare ที่เหมาะกับโค้ดปัจจุบัน

1. เลือกโดเมนและ Node host ที่มี persistent local volume; เว็บและ worker ใช้ DB เดียวกันบนเครื่องเดียว, ไม่ใช้ SQLite ผ่าน network filesystem
2. ตั้ง `APP_ORIGIN=https://<domain>`, `LINE_REDIRECT_URI=https://<domain>/api/auth/line/callback`, `DATABASE_PATH` absolute path; secrets อยู่เฉพาะ server
3. รัน `npm run check:production` บน host จริง และจัดการรายการ BLOCKED โดยยืนยันของจริง ไม่เปิด flag เพื่อผ่านเฉย ๆ
4. Build บน server; รัน `npm start` และ worker เป็น supervised services แยกกัน ให้ restart อัตโนมัติ; มี worker เพียงตัวเดียว
5. Cloudflare proxy DNS/WAF หน้า origin HTTPS และเลือก Full (strict); กันการเข้าถึง origin โดยตรง; account/admin/auth/api ไม่ใช้ Cache Everything
6. หมุน LINE Channel secret ที่เคยปรากฏในภาพ/แชต และอัปเดตเฉพาะ server env; ลงทะเบียน callback ของโดเมนจริงกับ LINE; ทดสอบ login/logout/admin/สมาชิกทั่วไป/ทดลองครบอายุ/เครดิตก่อนเปิด
7. ตั้ง encrypted backup ทุกวันและส่งสำเนาไปอีกระบบ; เก็บ BACKUP_ENCRYPTION_KEY แยกจากไฟล์ backup; ทดสอบกู้คืนเป็นรอบ
8. ตั้ง monitoring ของ `/api/health` และ authenticated `/api/admin/system`; health HTTP 200 ไม่ได้หมายความว่า scan coverage ครบ
9. ให้ worker รันตลาดเต็มวัน และตรวจ lifecycle สัญญาณ/เสียง/กรณี feed หยุด ก่อนเริ่มรับสมาชิกวงกว้าง

Cloudflare Workers ใช้ virtual filesystem ซึ่ง /tmp ไม่คงอยู่ข้ามคำขอ จึงไม่ใช่ที่เก็บ SQLite ลูกค้าและไม่เหมาะกับ worker loop เดิม หากต้องการย้ายทั้งระบบไป Workers ต้องเปลี่ยน data layer เป็น D1/Postgres และเปลี่ยนงาน background เป็น scheduler/queue ก่อน เป็นงาน migration แยกจากการแก้ความเสถียรรอบนี้

## คำสั่งที่เพิ่ม

- `npm run backup:database`: encrypted snapshot; เพิ่ม BACKUP_ENCRYPTION_KEY ใน .env.local แล้ว (ไม่ commit)
- `npm run check:production`: ตรวจ configuration ไม่แสดงค่าคีย์; exit 1 เมื่อยังมี BLOCKED
- `node --test src/security/*.test.mjs src/market-data/*.test.mjs src/auto-pick/*.test.mjs`

ไฟล์สำรองปัจจุบันอยู่ `data/backups/` และถูก Git ignore; เป็นสำเนาในเครื่อง ยังไม่ใช่ offsite backup และยังไม่ได้ตั้ง schedule บน production

## แหล่งข้อมูลทางเลือกที่ตรวจแล้ว

- [Twelve Data API](https://twelvedata.com/docs) มี REST/time series และ WebSocket; [Forex API v2](https://support.twelvedata.com/en/articles/12520817-forex-api-v2) เป็น composite mid-price และอธิบาย update ทุกนาที ต้องตรวจ 19 instrument/plan/สิทธิแสดงข้อมูลก่อนใช้ ไม่รับรองว่าแทน broker bid/ask ได้
- [SET real-time data](https://www.set.or.th/en/services/connectivity-and-data/data/realtime) เป็นช่องทางข้อมูล SET/TFEX/ประกาศบริษัท; ต้องเลือกบริการและสิทธิเผยแพร่ที่ตรงกับเว็บลูกค้า
- [Cloudflare fs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/) และ [Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [LINE Login reference](https://developers.line.biz/en/reference/line-login/)

ยังไม่ต่อผู้ให้บริการใหม่ที่ต้องซื้อแพ็กเกจ/ส่งข้อมูลลูกค้า/MCP ของผู้ใช้เข้าระบบสาธารณะ การเปลี่ยนฟีดต้องทดสอบ adapter กับ timestamp/แท่งปิด/OHLC/coverage จริงก่อน
