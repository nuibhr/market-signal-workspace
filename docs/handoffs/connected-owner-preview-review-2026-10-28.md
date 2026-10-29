# Connected owner preview — 28 October 2026

สถานะ: ทดลองอ่านข้อมูลจริงในแอปเดิมได้ 4 ตลาดบน localhost; Forex ยังไม่เชื่อมต่อ. ชุดแก้ไขนี้ยังไม่ commit/push/deploy.

## ผลเชื่อมต่อจริง

ตรวจเมื่อ 28 ตุลาคม 2026 เวลา 10:51 น. Asia/Bangkok. ผลเป็น snapshot ของชุดที่ทดสอบ ไม่ใช่การรับรอง coverage ทั้งตลาด.

| ตลาด | อ่านได้ / ชุดทดลอง | แหล่ง | เวลา/ข้อจำกัด |
|---|---:|---|---|
| Thai | 8/8 | Settrade | D1 ปิด 27 ต.ค. 2026; ตารางและกราฟ D1 |
| DR | 6/6 | Settrade | D1 ปิด 27 ต.ค. 2026; ราคาตัว DR ไม่ใช่ valuation bridge/FX |
| US | 7/8 | FMP EOD | D1 ปิด 27 ต.ค. 2026; อีกหนึ่งตัว PLAN_REQUIRED; ไม่เปลี่ยนแพ็กเกจ provider |
| TFEX | 8/8 | TFEX Open API ผ่าน Settrade | Quote ไม่มี timestamp ต้นทางทั้ง 8; source time=null; ไม่อ้าง realtime และไม่รับรอง candle/OI/liquidity |
| Forex | 0 | Owner ingestion | ยังไม่มี ingestion/heartbeat ใหม่; ไฟล์ MT5 เดิมที่พบเก่าหลายวัน จึงไม่ใช้เป็นข้อมูลปัจจุบัน |

ไม่มีการเติมราคาจำลอง, ใช้ Yahoo แทน, สร้างสัญญาณซื้อขาย หรือสร้าง performance จาก daily change.

## การใช้งานในแอปเดิม

- เปิด private entry ที่ runner สร้างไว้ใน task work/connected-preview-entry.json; redirect ไป /thai และตั้ง HttpOnly/SameSite=Strict cookie
- แอปแสดงตารางทดลองข้อมูลจริงสำหรับเจ้าของ และเปิดกราฟ D1 ของ Thai/DR/US ผ่าน chart เดิมได้. Thai Screener อ่าน snapshot ของเจ้าของในโหมดนี้ โดยไม่มี score/plan ที่ยังพิสูจน์ไม่ได้
- Owner preview ใช้ /api/owner-preview และระบุ disclosureScope=OWNER_INTERNAL, customerDisplayRights=UNCONFIRMED. ไม่ใช่ canonical customer envelope และไม่ใช้เป็นหลักฐานสิทธิ์เผยแพร่
- ต้องเปิด review mode, owner source mode, APP_ORIGIN เป็น loopback, secret capability และ expiry ที่ยังไม่หมดอายุพร้อมกัน. Runner bind 127.0.0.1:3217 และใช้ SQLite แยกสำหรับ preview. Session มีอายุ 2 ชั่วโมง
- การเปิด owner preview ไม่สร้าง admin/member/subscription หรือเปลี่ยน entitlement ของบัญชี. Customer canonical API ยังคง Guest ≤1 redacted, Trial ≤8, Starter ≤3, Pro ≤5, Ultimate ≤8; rights-unconfirmed ไม่คืนค่าราคาแม้ browser มี owner preview cookie
- คีย์ provider อ่านเฉพาะ allowlist จากไฟล์เดิมฝั่ง server เก็บใน process memory; ไม่ส่ง API key ให้ browser และไม่คัดลอกคีย์เข้า Git/report

## Native backend path

Thai/DR ไม่ต้องรอ observation ในฐานสแกนที่ว่างอีกต่อไป: native reader อ่าน closed daily bars จาก Settrade โดยตรง. US อ่าน FMP EOD และ TFEX อ่าน native quote. ตัด dependency ที่เคยบังคับต้องยืนยัน Yahoo ด้วยทั้งที่ไม่ได้ใช้ Yahoo. Customer loader ยังตรวจ display rights ของ provider ก่อนเรียก source.

แยก dataAsOf ของแท่งปิดจาก receivedAt ที่รับ API, คง receivedAt เมื่ออ่าน cache, ปิด source time หาก provider ไม่ส่ง, ตรวจ identity/OHLC/ลำดับและวันซ้ำ/current bars, allowlist fields และเก็บ unavailable ต่อแถว. Quality/session evidence ที่จำเป็นต่อ strategy ยังไม่ครบ จึงไม่เปิด signal/performance/execution.

## ทางเข้าลูกค้าที่นำออก

- Thai navigation และ nested Thai/DR Radar: พอร์ต & API / ALGO_EQ และ EquityPortfolioDesk
- Account: ฟอร์มกรอก broker/เลขบัญชีและ CTA เปิด Trial ผ่านเลขบัญชี; ไม่ลบข้อมูลสมาชิกเดิม ไม่เปลี่ยน tier/cap/Stripe/ราคา หรือกฎ redeem/renewal
- TFEX: BYOK status bar, shortcut, demo broker buttons, credential modal และ client POST portfolio function; คง what-if/risk calculator ที่ใช้ค่ากรอกเอง
- Forex: ConnectionPanel/diagnostics เฉพาะ trusted data owner จาก server; ลูกค้าทั่วไปไม่ poll owner MT5 API และไม่เห็น pairing/connector flow

API ฝั่ง portfolio/holdings/MT5 เดิมยังปฏิเสธ guest/member ก่อน provider call ตาม owner guard. การเอา flow ออกยึด contract read-only ของงานนี้ ไม่ได้สรุปว่า broker API ทุกประเภทผิดกฎหมาย. สิทธิ์ของการใช้งานแต่ละ provider ต้องดูตามบัญชีและข้อตกลงจริง; Settrade มี [เงื่อนไขข้อมูลของผู้ให้บริการรายอื่น](https://www.settrade.com/th/thirdparty-terms) แยกไว้. ไม่มีการตั้งสถานะสิทธิ์เผยแพร่ให้ลูกค้าเป็น CONFIRMED จากการทดลองครั้งนี้.

## ผลตรวจ

- npm test: 506/506, 0 failed, 0 skipped
- NUGAOM_REVIEW_MODE=true npm run build: PASS
- Customer HTTP regression matrix: 331/331
- Connected owner HTTP/real-provider checks: 31/31 รวม actual source reads, chart metadata, anonymous/forged/cross-origin denial, scope/cap, private caching, customer cap ทั้ง 5 tiers และหน้า Thai/DR/TFEX/Forex/Account ไม่มีทางผูก broker เดิม
- Customer readonly render regression: PASS รวม account cap, TFEX removed-control ReferenceError และ nested Thai/DR portfolio tab
- git diff --check: PASS
- Browser interaction/visual QA: ยังตรวจอัตโนมัติไม่ได้ เพราะ Local browser use ถูกปิดใน Work settings; HTTP/SSR/API ผ่าน ไม่อ้างว่า interaction QA ผ่าน

## สิ่งที่ยังค้าง

1. Forex ต้องมี owner MT5/EA ส่ง packet/heartbeat ใหม่ผ่าน owner ingestion ที่ยืนยันตัวตนและ expiry ได้; ห้ามใช้ไฟล์เก่าหรือเปิด customer pairing แทน
2. ตรวจสิทธิ์ FMP สำหรับ US ตัวที่ PLAN_REQUIRED; ไม่เปลี่ยนแผน/ค่าใช้จ่ายอัตโนมัติ
3. การเปิดให้ลูกค้าอ่านค่าราคาต้องมี display-license evidence จริงและ canonical rights record ที่ตรวจแล้ว; private exploration ไม่ได้ให้สิทธิ์เผยแพร่
4. Strategy readiness, DR valuation bridge, verified performance และ deployment ยังไม่ผ่าน gates เดิม
5. ตรวจ interaction ใน browser และ review diff ก่อนอนุมัติ commit ชุดใหม่; commit เดิม 061ea46 ยังเป็น HEAD
