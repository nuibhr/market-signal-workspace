# ผลทดสอบก่อนเปิดใช้งาน — 15 ตุลาคม 2026

**ยังไม่ผ่านเกณฑ์เปิดให้ลูกค้าใช้จริง** โค้ดหลักและการทดสอบ backend ผ่าน แต่ AutoPick ยังมี coverage ไม่ครบ, เว็บ Cloud ยัง maintenance/scanner offline, MT5 ยังต้องมีเซิร์ฟเวอร์ Node ถาวร และยังไม่ได้รับรองเส้นทาง LINE/มือถือ/Terminal จริง

ตรวจจาก main ฐาน `d9978db` และแก้ในรอบนี้ ผล HTTP ล่าสุดบันทึกเมื่อ **15 ต.ค. 2026 เวลา 11:41 น. กรุงเทพฯ** (`2026-10-15T04:41:29.093Z`) เป็น snapshot ไม่ใช่การรับรองทุกตลาดตลอดวัน

## ปัญหาที่พบและแก้แล้ว

| ปัญหา | สิ่งที่แก้ | หลักฐาน |
| --- | --- | --- |
| MT5 จับคู่/โหลดสถานะค้างเมื่อเครือข่ายหรือ response body ไม่จบ | จำกัดแต่ละคำขอ 15 วินาที รวม JSON parsing; แจ้งผลที่ยังยืนยันไม่ได้; ไม่ retry การสร้างกุญแจอัตโนมัติ เพราะกุญแจอาจสร้างสำเร็จแล้ว | จำลอง fetch ค้างและ JSON ค้าง ผ่านทั้งสองกรณี |
| คำตอบ MT5 เก่าอาจกลับมาทับสถานะใหม่หลังเปลี่ยน symbol/timeframe หรือ revoke | ยกเลิกและตรวจรุ่นของคำขอเก่า; พัก polling ระหว่าง mutation; refresh ด้วย selection ล่าสุด; เมื่ออ่านล้มเหลวให้ราคา/กราฟเป็น stale | จำลองคำตอบกลับผิดลำดับและ connected snapshot เก่าหลัง revoke แล้วไม่คืนสถานะเดิม |
| ผู้ช่วย AI สร้าง request ID ใหม่หลังคำตอบหลุด อาจทำให้คำถามซ้ำคิดโควตาอีกครั้ง และข้อความเดิมอ้างว่าไม่เสียโควตาทั้งที่ยังไม่รู้ผล | เก็บคำถามและ request ID เดิมระหว่างรอยืนยัน; มีปุ่มยืนยันผลคำถามเดิม; ป้องกันกดส่งซ้อน/เริ่มหัวข้อใหม่ระหว่างค้าง; ตัดข้อความรับรองโควตาเมื่อไม่ทราบผล; ป้องกันประวัติ GET เก่าทับคำตอบใหม่ | fixture SQLite ใช้ครบ 5 คำถามฟรีแล้ว เติม 2 เครดิต บันทึกคำตอบสำเร็จแต่จำลองคำตอบหลุด retry กลับมาคำตอบเดิม เหลือ 1 เครดิตเท่าเดิม มีคำถามแถวนั้นเพียง 1 แถว และเรียกการวิจัยครั้งเดียว |
| หน้าตรวจ readiness หลักไม่ตรวจ MT5 ที่เพิ่งรวมเข้ามา | เพิ่มเงื่อนไข receiver สำหรับ Node/HTTPS/LINE/ฐานถาวร/ปิดทางลัดพัฒนา และหลักฐานกู้คืนฐาน MT5 แยกจากฐานสมาชิก | D1, ฐานร่วม, ฐานไม่ถาวร, server list ว่าง และ development shortcuts ถูก block; ไม่แสดง credential/path ของฐานใน report |
| HTTP ในเครื่องเข้าไม่ได้ระหว่างตรวจรอบใหม่ เพราะไม่มี process ฟังพอร์ต 3000 | เปิด dev server กลับบน loopback พอร์ตเดิม แล้วตรวจ HTTP ใหม่ครบ | รอบหลังเริ่ม server ผ่าน 54/54; การเปิด dev server ไม่ใช่การเตรียม hosting ถาวร |

การยืนยัน AI ที่ค้างเก็บในหน่วยความจำของหน้านั้น ไม่มีการบันทึกคำถามลง browser storage เพิ่ม หาก reload ให้ตรวจประวัติคำตอบก่อนถามซ้ำ และหาก login/สิทธิหมดอายุระหว่างรอยืนยัน ต้องคืนสิทธิก่อน retry ได้ การเปลี่ยนนี้ไม่ได้เปลี่ยนสูตรเครดิตหรือค่าบริการ

## อะไรใช้งานได้แล้ว และมีข้อจำกัดอะไร

| ส่วน | ผลที่ตรวจได้แล้ว | ส่วนที่ยังไม่พร้อม/ยังไม่ยืนยัน |
| --- | --- | --- |
| Robot 3D, `/`, `/markets`, หน้าตลาด | HTTP เปิดได้ทั้งสองทางเข้าและหน้าตลาดทั้งหมด source เชื่อม Forex/บัญชี/Community เดิม | HTTP/build ไม่ยืนยันการเรนเดอร์ WebGL, การคลิก, pointer, มือถือ หรือ performance จริง |
| LINE/สมาชิก | ตั้งค่า LINE มีอยู่; backend session, trial 14 วัน, ต่ออายุ/โค้ด/เครดิต ผ่าน fixture รวม native D1; guest เข้า admin/ข้อมูลส่วนตัวไม่ได้ | LINE channel เคยตรวจว่า Published แล้ว แต่รอบนี้ไม่ได้ทำ hosted consent และสมัคร/ออก/เข้าใหม่ด้วย LINE 2 บัญชีจริง |
| กราฟไทย/DR/TFEX | ตัวอย่าง PTT, AAPL80, S50Z26 คืนข้อมูลจริง HTTP 200 | เป็นการสุ่มเครื่องมือ/timeframe ไม่ได้ตรวจทุก symbol และต้องยืนยันสิทธิแสดงข้อมูลก่อน production |
| หุ้นสหรัฐฯ | NVDA D1 คืน 300 แท่ง ล่าสุด 14 ต.ค.; ปฏิเสธ 15m ด้วย 422 อย่างชัดเจน | เส้นทางนี้รองรับรายวัน ยังไม่มี US intraday ผ่าน API นี้ |
| Forex / CFD Command Center | หน้าใหม่เปิดได้ มี 19 guest instruments; receiver ในเครื่องเปิดและผูก owner ตาม LINE; fixture ทดสอบ pairing/ingestion/isolation/revoke; ดาวน์โหลด EA/relay มีใน build | หน้าเริ่มต้นเป็น Demo จนเชื่อม MT5; guest ไม่ได้รับ native live quote; Yahoo history ที่ API คืนได้ไม่ได้เป็นหลักฐานว่า dashboard MT5 รับข้อมูลจริงแล้ว |
| Forex account/positions, AI Analysis, News/Calendar, Alerts | มีตัวอย่าง UI แยกป้าย Demo/NO FEED; risk calculator ใช้ค่าที่กรอกเอง | ไม่เชื่อมยอดบัญชี/สถานะเทรด, ไม่มี Forex AI signal/ข่าว/ปฏิทินจริง, สวิตช์ Alerts ยังไม่ส่งแจ้งเตือนจริง; Journal และ favorites ของ Forex ยังเป็น state ชั่วคราวของหน้า |
| MT5 ข้อมูลจริง | มี read-only receiver/EA v2.20 และ Mac/Windows relay; ไม่รับรหัสผ่านหรือส่งคำสั่งเทรด | ต้องจับคู่ใหม่บน main ด้วยสมาชิกที่ถูกต้อง; ไม่ย้าย pilot 1,268 instruments ของ owner เดิมให้สมาชิกอื่น; ต้องตรวจ native Terminal, UTC clock, bid/ask และแท่งปิดจริงบน Mac/Windows; Cloudflare/D1 ยังรับ MT5 ไม่ได้ |
| Community/คุยทีม | SQLite/native D1 ผ่าน room rights, private inbox, team transfer/revoke, pagination, read receipts, moderation, lost confirmation และ rate limit; guest ถูกปฏิเสธ | ยังต้องลองสองบัญชีจริงบนมือถือ; กำหนดทีมจริงและ migration บนระบบที่จะเปิดใช้ |
| พอร์ตโค้ช/ผลสัญญาณ | Paper accounting/owner/permissions และผลที่อิง ledger ผ่าน tests; public coaches เปิดได้ | ยังไม่ใช่ broker fill หรือการเชื่อมพอร์ตเทรดจริง; ทดสอบบัญชีโค้ชจริงก่อนรับรอง |
| AutoPick/แจ้งเตือน | lifecycle, cutoff, retries, immutable ledger, popup catch-up และ speech adapter ผ่าน tests; local worker รุ่นถูกต้อง running | coverage สดยังไม่ครบตามตารางถัดไป; เสียงเป็น adapter test ยังไม่ยืนยันเสียง/permission บนอุปกรณ์; ไม่มี server push/LINE push จริง |
| ผู้ช่วย AI | fixture quota/credits/retry หลังคำตอบหลุดผ่าน; มี Bigdata config indicator และ guards | ไม่เรียก Bigdata แบบเสียค่าใช้จ่าย/หักเครดิตสมาชิกจริงในรอบนี้ ต้องรับรองคำตอบและแหล่งอ้างอิงผ่านบัญชีทดสอบจริงบน hosting |
| ข่าว/เศรษฐกิจ | `/api/news`, `/api/macro` ตอบ available ในเครื่อง | ไม่ได้ยืนยันความครบ/ทันเวลาทุกข่าวหรือสิทธิการเผยแพร่ |
| รายการโปรด/พอร์ตสมาชิก | anonymous API ไม่เปิดข้อมูลและไม่อนุญาตเขียน | ยังต้องยืนยันใช้งานจริงข้ามบัญชี/ข้ามอุปกรณ์ รวม import guest favorites; ไม่ใช้การผ่าน HTTP guard แทนการทดสอบ flow |
| การชำระเงิน | ขอและอนุมัติต่ออายุ/โค้ดผ่าน backend fixture | ยังไม่มีหน้าจ่ายเงินหรือการตัดเงินอัตโนมัติ เป็นขั้นตอนแอดมินตรวจหลักฐาน |
| Production | Next และ Cloud bundle สร้างผ่าน; private review endpoints และสิทธิ admin ตอบตามคาด | เว็บสาธารณะ Cloud ยัง 503 maintenance และ scanner offline; source บน GitHub ไม่ได้ deploy อัตโนมัติในงานนี้ |

## ข้อมูลตลาดที่สุ่มทดสอบจริง

| ตัวอย่าง | แหล่งข้อมูล | จำนวนแท่ง | ผล |
| --- | --- | ---: | --- |
| PTT 15m | Settrade Market API | 375 | HTTP 200 / available |
| AAPL80 15m | Settrade Market API | 772 | HTTP 200 / available |
| S50Z26 15m | TFEX Open API | 391 | HTTP 200 / available |
| NVDA D1 | Financial Modeling Prep EOD | 300 | HTTP 200 / available; ล่าสุด 2026-10-14 |
| EUR/USD 1h | Yahoo Finance Historical | 5,000 | HTTP 200 / available; ไม่ใช่ bid/ask จาก MT5 |

ข้อมูล intraday อาจรวมแท่งปัจจุบันที่ยังไม่ปิด การคืน bars/`freshness: recent` ไม่ได้อนุญาตให้นำแท่งเปิดไปยืนยัน entry; การกรองแท่งปิดมี tests แยก ขอบเขต catalog ยังคงไทย 150, DR 141, TFEX 10, US/ETF 600; AutoPick US สแกน 500 ไม่ใช่ทุกหุ้นทั้งตลาด

## AutoPick ที่ยังไม่ผ่านเกณฑ์ใช้งานจริง

Snapshot จาก API เวลา 11:41 น. กรุงเทพฯ:

| รอบปัจจุบัน | คาดหวัง | ประเมินแล้ว | ไม่เข้าเกณฑ์ | ข้อมูลไม่ได้ | พ้นเวลาโดยไม่ครบ | รอ retry | สถานะ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ไทย รอบเช้า 15 ต.ค. | 150 | 14 | 0 | 2 | 134 | 0 | ended |
| DR รอบเช้า 15 ต.ค. | 141 | 11 | 1 | 2 | 127 | 0 | ended |
| US รอบ EOD ล่าสุด | 500 | 427 | 0 | 1 | 0 | 72 | active |

`remaining = 0` ของไทย/DR หมายถึงปิดสถานะเมื่อพ้นเวลา ไม่ได้หมายถึงสแกนสำเร็จครบ รายการ unavailable ไทยคือ BCP/BDMS, DR คือ BRKB80/CAMBRI80, US คือ WBD ณ snapshot นี้

worker ยัง running และ runtime version ตรง แต่ health ตลาดเป็น candidate-degraded/degraded มีงานที่เริ่ม 11:07 แล้วจบ 11:24 ซึ่งข้าม cutoff 11:15 และมีช่องว่างระหว่างรอบใน runtime หลักฐานนี้ยังแยกสาเหตุเครื่องพัก/เครือข่าย/ผู้ให้บริการไม่ได้ การทดสอบจำลอง full roster ผ่าน ไม่แทนหลักฐาน full roster จริง ต้องใช้ runtime ต่อเนื่องและตรวจรอบใหม่จริง ห้ามย้อนสร้าง entry/signal ของรอบที่พลาดเพื่อให้ตัวเลขดูครบ

## หลักฐานการตรวจ

- ชุดรวม **163 tests/subtests ผ่าน, 0 fail/skip**: membership/AI credits, community, native D1 migration/recovery, coach, security, market data, scanner coverage/lifecycle/notifications และ Forex/MT5 รวม 10 regression ใหม่
- `NUGAOM_REVIEW_MODE=true npm run build` ผ่าน ใช้ `.next-review` แยกจาก dev server
- `npm run cloud:build` ผ่าน เตรียม bundle เท่านั้น ไม่มี deploy
- `node scripts/prelaunch-smoke.mjs` (เรียกได้ผ่าน `npm run check:prelaunch`) ผ่าน **54/54**: 9 หน้า, 4 protected redirects, 9 public/member-status reads, 9 private-data guards, 16 anonymous/cross-origin write guards, scanner-run guard, US timeframe limit และ 5 provider samples
- `npm run cloud:check` ผ่านเงื่อนไข private review; public maintenance 503 และ health scanner offline ตามที่ตั้งอยู่ ไม่ใช่ผ่าน launch acceptance
- `npm run check:production` exit 1 ตามคาด: **12/18 checks blocked** บน environment ในเครื่อง ได้แก่ HTTPS/callback, storage ถาวร, offsite recovery, สิทธิข้อมูลที่ใช้ และ MT5 receiver/recovery; ผลนี้ไม่ใช่ config inspection ของ Cloud Worker
- `git diff --check` ผ่าน

ไฟล์หลักฐานอยู่ใน outputs ของแชท: `prelaunch-tests-2026-10-15.log`, `prelaunch-http-2026-10-15.json`, `prelaunch-next-build-2026-10-15.log`, `prelaunch-cloud-build-2026-10-15.log`, `prelaunch-cloud-http-2026-10-15.log`, `prelaunch-config-2026-10-15.log` ไม่มี session, key, token หรือข้อมูลพอร์ตสมาชิกใน report

HTTP และ source/fixture tests เป็นขอบเขตที่ตรวจได้ในรอบนี้ Browser automation ของ localhost มีข้อจำกัดจากรอบก่อน จึงไม่ใช้ช่องทางอื่นข้ามข้อจำกัด และไม่อ้างว่า visual/WebGL/mobile/audio acceptance ผ่าน

## งานที่ต้องปิดก่อนเปิดลูกค้า

1. ยืนยัน hosting เป้าหมายและ storage ถาวร: หากใช้ Cloudflare/D1 ต้องแยก/ปรับ Node MT5 receiver ก่อน; หากใช้ Node ต้องมีฐานสมาชิกและ MT5 แยกกัน พร้อม worker ที่ทำงานต่อเนื่อง
2. ตั้ง production HTTPS/LINE callback ให้ตรงระบบจริง ยืนยันสิทธิใช้/แสดงข้อมูลจากผู้ให้บริการที่เลือก และตรวจ hosting limits
3. สำรองนอกเครื่องและทดลองกู้คืนฐานสมาชิกกับ MT5 แยกกัน `backup:database` เดิมสำรองเฉพาะฐานสมาชิก; อย่าตั้ง `FOREX_MT5_BACKUP_RECOVERY_CONFIRMED=true` ก่อนมีหลักฐานจริง
4. ทำ customer cutover/migrations 0008 และ 0009 บนเป้าหมายตามแผนเดิม แล้วตรวจ isolation/restore ก่อนรับข้อมูลลูกค้า
5. รันและสังเกต AutoPick ครบ roster จริงทั้งไทย, DR เช้า/กลางคืน และ US พร้อม source failures ที่อธิบายได้; ไม่ใช้แค่ heartbeat เป็นเกณฑ์ผ่าน
6. ทดสอบยอมรับด้วย LINE 2 บัญชี: login/logout, trial/ต่ออายุ, favorites/พอร์ต, ห้องสมาชิก/คุยทีม, หมดสิทธิ/เพิกถอน, lost confirmation ของ AI/Community; ตรวจ WebGL/จอมือถือ/เสียงบนอุปกรณ์จริง
7. จับคู่ main กับ MT5 ของสมาชิกทดสอบบน Mac/Windows ตรวจ clock, bid/ask, symbol suffix, แท่งปิด, revoke และการเชื่อมใหม่; ปิด/ระบุชัดฟังก์ชัน Forex ที่ยังเป็น Demo ก่อนเปิดขาย

งานนี้ไม่ได้เปลี่ยน credential/สิทธิสมาชิกจริง/flag เปิดลูกค้า, ไม่ยิงคำสั่งเทรด, ไม่เพิ่มข้อมูลทดสอบลงฐานสมาชิกจริง และไม่เปลี่ยนโหมด maintenance หรือ deploy ให้ลูกค้าโดยอัตโนมัติ
