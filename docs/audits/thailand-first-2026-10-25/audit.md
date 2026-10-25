# Thailand-first SaaS — ตรวจระบบและแผนพาณิชย์ระยะที่ 0

25 ตุลาคม 2026 · Nugaom AI Pick · source baseline `b2f8cb233f397cf1c0452982d9a0e2d87a15f8d7`

**ข้อสรุป:** มีระบบจริงที่ต่อยอดได้ จึงไม่ควรรื้อใหม่ แต่ยังไม่ควรเปิดรับเงินจริงหรือขายเป็นบริการ
สแกน intraday/แจ้งเตือนส่วนบุคคลครบวงจร จุดเร่งด่วนคือความถูกต้องของข้อมูลพอร์ต,
payment-to-entitlement, LINE acceptance, สิทธิข้อมูล และงบ AI
แนะนำ Pro 299 บาทเป็นข้อเสนอหลักสำหรับทดสอบตลาด โดยขายความสะดวกในการติดตามไทย/DR/Forex
และความเสี่ยงพอร์ต ไม่ขายด้วยจำนวนคำถาม Research สูงอย่างเดียว

## ขอบเขตและหลักฐาน

รอบนี้ตรวจ source, schema/migrations, server guards, UI, adapters, scanner scheduling และ
deployment config รวมผลทดสอบที่บันทึกไว้ ไม่แก้ application code/config/DB/ราคา/กลยุทธ์เพิ่มเติม
มี checksum 565 source/config files ใน `baseline.json` สำหรับเปรียบเทียบก่อนงานถัดไป
ไม่ได้อ่านข้อมูลลูกค้าทั้งฐานใหม่หรือรับรองความครบถ้วนของทุก record/backup restore

คำกำกับสถานะ:

- **ตรวจจริง**: อ่านโค้ดหรือมีผลเรียก endpoint/runtime ที่ระบุไว้
- **ติดตั้งแล้ว**: งานที่อนุญาตและทำก่อนรอบ audit นี้ ไม่ใช่สิ่งที่เพิ่งเปลี่ยนตาม Master Prompt
- **ทดสอบผ่าน**: ระบุชนิด unit/integration/runtime ชัดเจน ไม่แทนผล broker จริงหรือ load test
- **สมมติฐาน**: ใช้คำนวณ/ตั้งเป้าหมาย ยังไม่มี customer cohort หรือ measurement รองรับ
- **เสนอ**: ไม่เปิดใช้งาน ไม่แทนกฎเดิม

หลักฐานประกอบ snapshot อยู่ในโฟลเดอร์ `evidence/`: `vps-final-api-checks.json`,
`daily-scan-acceptance.json`, `vps-web-continuity.json`, `vps-worker-cpu-checks.json`,
`vps-ai-bridge-check.json`, `stripe-live-readiness.json`, `bigdata-cost-sample.json`
และผล `458 pass / 0 fail` ที่สรุปพร้อม SHA-256 ของ log ต้นฉบับใน `evidence/regression-suite-summary.json`
ผล Stripe Live ที่อ้างเป็น snapshot วันที่ 24 ต.ค.; ไม่ใช่การยืนยันสถานะบัญชีล่าสุดซ้ำ

## 1. Current system audit และ feature inventory

| ระบบ | สถานะที่พิสูจน์ได้ | ขอบเขต/สิ่งที่ยังไม่ผ่าน |
|---|---|---|
| เว็บ/hosting | ติดตั้ง Next.js บน VPS, URL เดิมเป็น proxy; ตัวอย่าง 50 requests CPU สูงสุด 1 ms, ไม่มี exceededCpu | ตัวอย่างสั้น ไม่ใช่ SLA หรือ load certification |
| D1 และ sessions | ฐานสมาชิกเดิมผ่าน authenticated gateway; session ก่อน cutover ใช้ต่อได้; guest แยกจาก Demo | ยังไม่มี restore drill ของฐานสมาชิกและ private MT5 ในรอบนี้ |
| LINE Login | start endpoint 307 ไป access.line.me และ callback URL ถูกต้อง | ยังไม่มี human consent → callback → session ด้วยบัญชีลูกค้าทั่วไป |
| Demo | ทดสอบ onboarding/trial/starter/pro/ultimate/expired อ่านสิทธิครบ 6 สถานะ | Demo ใช้ AI Research จริงตามอนุญาตเดิม; ยังไม่มี global spend cap ที่ตรวจพบ |
| Stripe | Test catalog 3 plans และ Checkout URL เปิด HTTP 200 โดยไม่ submit payment | ยังไม่ผ่านจ่ายจริง/renewal→D1สิทธิ; Live snapshot เดิมไม่มี THB recurring prices/webhook |
| Shared scan | รอบ 07:00 ไทย 25 ต.ค. ตรวจ 926 instruments เสร็จประมาณ 07:38; idle รอรอบถัดไป | ตรวจรอบเสร็จ ≠ ทุก symbol มีข้อมูลใหม่หรือมี signal ใช้เทรดได้ |
| Shared market APIs | ไทย 145/150, DR 141/141, US 599/600, Forex 17/19, TFEX 14/16 มีราคาและ source timestamps | ราคาเป็น nonexpired saved series ไม่รับรองว่าสด/เพิ่งเกิดวันนี้; มีรายการไม่พร้อม |
| Cache/refresh | เปิด/ค้นหน้า shared อ่านแคช; guest shared 403; manual full shared scan 409 | capability manualDailyScan ในสิทธิยัง true บาง tier แต่ daily mode ปฏิเสธจริง ต้องแก้คำอธิบาย UI |
| US stocks | `/us`, 600-symbol roster, strategies/data routes ยังอยู่; API/browser รอบก่อนหน้าตอบได้ | ไม่ลบ แม้ลด prominence; บาง FX diagnostic ไม่มี source ตอบ 503 |
| MT5/Vantage | มี owner-scoped connection token hash, sync/pagination/revoke และ persistent Node volume; tests ใช้ fixtures | ยังไม่ยืนยัน real customer terminal ในรอบนี้; ไม่ใช่ทุก broker/ทุก symbol |
| Settrade portfolio | reader เรียก account-info/portfolios ด้วย credentials ของคำขอ, mask account, ไม่ persist keys; unit schema tests | live credentials/portfolio จริงยังไม่ทดสอบ; UI enrichment มีปัญหาความถูกต้องตาม P0 ด้านล่าง |
| Watchlist | บันทึก D1 แยก member, import-once, server limit 500 รายการสำหรับผู้ล็อกอิน | ยังไม่ได้แยก limit ต่อ tier; `savedCloudWorkspace:false` ไม่ได้แปลว่า favorites ไม่บันทึก |
| Alerts | มี notification history/cursors และ manual Telegram handlers | ไม่ใช่ personalized smart alert scheduler; rights.serverAlerts=false; ไม่ทดสอบส่งหาบุคคลอื่น |
| AI chart | ผ่าน Workers AI transport/schema หนึ่งคำขอสั้น | ไม่รับรองคุณภาพทุกสินทรัพย์หรือว่าทุกปุ่มใช้ daily chart ได้; มี freshness/eligibility guards |
| AI Research | Bigdata real integration, citations, conversation owner check, quota reservation/idempotency | ไม่ใช่ portfolio assistant ครบวงจร; unit cost/coverage ไทยต้องวัดหลายคำถาม |
| Strategy history | มี rule_version, signal lifecycle และ research replay ที่ระบุ simulation | ไม่ใช่ broker fills/ผลตอบแทนจริง; ห้ามนำ research simulation ไปอ้าง live performance |
| Options/news/fundamentals | Options shared ไม่มี verified daily chain จึงเว้นว่าง; ข่าวติดเครดิต; missing source แสดง unavailable | ไม่เติมตัวเลขแทน; การต่อสิทธิข้อมูลใหม่ยังจำเป็น |
| TFEX rendering | แก้ comparator ที่ขาด USD rank และเพิ่ม regression test; release daily6 ติดตั้งแล้ว | full-page browser rerun รุ่นสุดท้ายถูก approval review บล็อก จึงยังไม่รับรองว่าไม่มี hydration error บน production |
| Daily/weekly brief, custom alerts, unified portfolio | มีส่วน UI/normalization บางชิ้นที่นำกลับใช้ได้ | บริการ end-to-end ที่ตามชื่อยังไม่ครบ ไม่ควรขายว่าเปิดใช้ได้แล้ว |

### ข้อบกพร่องและความเสี่ยงตามความสำคัญ

**P0 — ความถูกต้องของพอร์ต LIVE:**
`src/app/api/equity/portfolio/route.js:251` เป็นต้นไปเริ่ม Stage 2 เป็นค่าเริ่มต้น,
แปลง unrealized P/L เป็น Stage, ใช้ marketPrice×0.94 / avgCost×0.92 เป็นเส้นความเสี่ยง,
บอกกำไร ≥15% ว่าแตะ 2R และให้ DR เป็น FAIR/FX ทรงตัว โดยไม่มี underlying price,
conversion ratio/FX หรือกราฟยืนยันใน path นี้
เมื่อข้อมูล market value ไม่พอ health ยังมี fallback 75
ข้อมูลยอดจริงจาก broker ไม่ได้ทำให้ข้อสรุปเหล่านี้เป็นผลวิเคราะห์ที่ตรวจแล้ว
**เสนอ** เก็บ broker balances/holdings ตามเดิม แต่แยก diagnostic ว่า unassessed/heuristic
และคืน null หากไม่มีหลักฐาน เสนอ patch แยกก่อนแก้ เพราะ output นี้อาจมีผู้ใช้พึ่งพา
ไม่เปลี่ยนสูตร Entry/TP/SL ของเครื่องสร้างสัญญาณกลาง

**P0 — การรับเงินจริง:** opening Checkout ผ่านแล้ว แต่ end-to-end Test paid webhook และ
สิทธิหลังต่ออายุต้องผ่านก่อน Live; ไม่ให้สิทธิจาก success URL เพียงอย่างเดียว
มีโค้ด verify signature, idempotency และ paid_until แล้ว จึงทดสอบ/ต่อให้ครบจากของเดิม
ไม่ต้องสร้างระบบ billing ใหม่

**P0 — สิทธิข้อมูล:** flag `*_DISPLAY_RIGHTS_CONFIRMED` เป็นการตั้งค่า ไม่ใช่สำเนาสัญญา
SET แยก personal/internal use จาก redistribution และให้ติดต่อเพื่อราคา redistribution
การหน่วงราคา การจ่าย API หรือการเชื่อมบัญชี broker ของสมาชิก ไม่ได้ยืนยันสิทธิแจกต่อทั้ง SaaS
ต้องตรวจ display/non-display/derived data, caching, retention, territory และ user limits ตามสัญญาแต่ละ source
[ข้อมูลบริการและขอบเขตของ SET](https://www.set.or.th/app/online-data/market-data?lang=en)

**P0 — ต้นทุน AI:** paid plans ให้ Research 10/50/150 ต่อวัน แต่ยังไม่มี project spend budget
ที่ตรวจพบใน path assistant; quota ต่อ member และ rate 8/min ไม่ใช่เพดานค่าใช้จ่ายรวม
Demo เปลี่ยน role ได้และเรียก AI จริงตามอนุญาตเดิม ต้องวิเคราะห์ abuse/cost โดยคงสิทธิที่อนุมัติจนกว่าจะตกลง cap

**P1 — Scale bottlenecks:** `request-guard.mjs` เขียน D1 rate-limit counter ต่อคำขอที่เรียกใช้
gateway hops/auth/quota ยังทำให้จำนวน Worker requests และ D1 writes โต แม้เว็บย้ายไป VPS
ไม่มี measurement rows_read/written ต่อ endpoint ครบ จึงยังตอบจำนวน concurrent users แน่นอนไม่ได้

**P1 — ความหมายข้อมูล/UI:** demo portfolio GET คืนตัวอย่างชัดเจนว่ามี mode DEMO แต่ต้องยืนยัน
ทุกหน้า/mobile ไม่แสดงเป็นพอร์ตจริง; TFEX margin/sizing มีสมมติฐานคงที่ที่ต้องมีวันที่และ source
ราคา/Stage/ความเป็นธรรมของ DR ต้องแยกคนละแหล่ง ไม่ใช้กำไรขาดทุนเฉพาะคนแทน market trend

**Security/Compliance:** root 0600 และ token hashing ช่วยจำกัดการเข้าถึง แต่ยังไม่ใช่หลักฐานว่า
ทุก secret/private volume มี application encryption/KMS และ restore ที่ทดสอบแล้ว
ต้องทบทวน retention/consent/PDPA, log redaction, per-member isolation, admin audit และ key rotation
รหัส VPS ที่เคยพิมพ์ในแชตควรให้เจ้าของหมุนใหม่และวาง SSH key policy โดยไม่เปลี่ยนทางเข้าเองใน audit นี้
ระบบต้องไม่ส่งคำสั่งซื้อขาย; investor password ของ MT5 เป็น read-only ตามเอกสาร MetaTrader แต่ต้องยืนยัน
ขอบเขตสิทธิของ adapter/บัญชีที่เชื่อมจริงด้วย
[MetaTrader read-only password](https://www.metatrader5.com/en/mobile-trading/iphone/help/settings_accounts/account_passwords)

ก.ล.ต. แยกธุรกิจที่ปรึกษาการลงทุนและที่ปรึกษาสัญญาซื้อขายล่วงหน้าไว้ในกลุ่มกำกับ
ก่อนขายคำแนะนำเฉพาะบุคคล/ซื้อขายผ่าน subscription ต้องให้ผู้เชี่ยวชาญตรวจ product claims,
นิติบุคคล/ผู้ให้คำแนะนำและใบอนุญาตที่เกี่ยวข้อง รวมขอบเขต Forex/ผู้ให้บริการต่างประเทศ
ข้อความว่า “เพื่อการศึกษา” อย่างเดียวไม่ใช่ข้อสรุปว่าได้รับยกเว้น
นี่เป็นประเด็นต้องตรวจ ไม่ใช่คำวินิจฉัยว่าธุรกิจปัจจุบันได้รับอนุญาตหรือฝ่าฝืนกฎหมาย
[ก.ล.ต. ผู้ประกอบธุรกิจตัวกลาง](https://www.sec.or.th/TH/Pages/LAWANDREGULATIONS/INTERMEDIARIES.aspx)

## 2. Competitor และ product gaps

| ตัวเทียบ/หลักฐานทางการ | สิ่งที่เสนอแก่ลูกค้า | ช่องว่างของเรา/แนวทางแข่งขัน |
|---|---|---|
| [Settrade Streaming](https://www.settrade.com/th/services-and-tools/trading-program/basic/streaming/faq) | ตลาดไทย/อนุพันธ์ ข้อมูล กราฟ แจ้งเตือนและการซื้อขายผ่าน broker ที่ร่วม | ไม่ควรขายเพียงกราฟหรือราคาไทยเพิ่มอีกแอป; ใช้ read-only context/watchlist/risk explanation ข้ามพอร์ตเป็นคุณค่า |
| [StockRadars ผ่าน AIS](https://ais.stockradars.co/) | ราคา real-time, price/active alerts, radars และ portfolio จำลอง; หน้าเสนอ Premium 1,099 บาท/เดือน ไม่รวม VAT ต่อเนื่อง 12 รอบบิล | ราคาเฉพาะช่องทางนี้ ไม่ใช่ราคาต่ำสุดทุกช่องทาง; เราต้องพิสูจน์การแจ้งเตือนที่มีประโยชน์และความต่างของข้อมูลจริงกับจำลอง |
| [TradingView pricing](https://www.tradingview.com/pricing/) | กราฟหลายตลาด/indicators/watchlists/alerts; Essential ที่ตรวจ $12.95/เดือน billed annually, 20 price และ20 technical alerts | ไม่แข่งด้วยจำนวน indicators หรือเลียนแบบหน้าจอ; เจาะภาษาไทย DR risk และบริบทพอร์ต MT5 |
| [efin ประกาศผลิตภัณฑ์ล่าสุด](https://www.efinancethai.com/LastestNews/LatestNewsMain.aspx?id=MTRDVWZJK1FqWnc9) | ประกาศ efinAI, Scan & Ranking, StockPickUp web และ MCP | AI+scan อย่างเดียวไม่ใช่จุดต่างแล้ว; เน้นเหตุผลที่ตรวจสอบย้อนกลับและ workflow ไทย→DR→Forex; ไม่เดาราคาที่ไม่ได้ยืนยัน |

ข้อมูลคู่แข่งเป็นสิ่งที่ vendor อธิบาย/เสนอ ไม่ได้ทดสอบบัญชีชำระเงินของคู่แข่งด้วยตนเอง
ยังไม่มีหลักฐาน cohort ว่าลูกค้าจะย้ายมาเพราะ UI หรือราคา จึงตั้ง customer interview 10–15 คน,
ทดสอบงานเช้า/หลังตลาด/ตรวจพอร์ต และ willingness-to-pay ก่อนเพิ่ม feature count
US มี 600 จาก 926 instruments ในรอบ scan แต่ยังไม่มี usage analytics พิสูจน์ว่าใช้มากที่สุด
การลด prominence ไม่ใช่เหตุผลให้ลบ US data, strategies หรือประวัติ

## 3. Feature roadmap A–P

ทุก cost ด้านล่างเป็น estimate/หน่วยงบ ไม่ใช่ใบเสนอราคา และไม่รวมสิทธิ feed ที่ยังไม่ทราบ
P0 = ความถูกต้อง/เปิดขาย, P1 = product value แรก, P2 = หลัง pilot, P3 = รอ retention proof

| ID/Feature | ปัญหาลูกค้า → คุณค่าธุรกิจ | Priority/ความยาก | แหล่งข้อมูล / tier เสนอ | งบเพิ่มโดยประมาณ | Acceptance และวิธีตรวจ |
|---|---|---|---|---|---|
| A Thai Opportunity Scanner | หา shortlist เช้า → กลับมาใช้ประจำ | P1/กลาง | shared licensed Thai candles; Starter+ | full scan ต่อสมาชิกเพิ่ม≈0 แต่ JSON/DB readsคิดตามโมเดล | รายชื่อ/เหตุผล/เวลา/เวอร์ชันตรง saved results; replay captured bars และ no duplicate full scan |
| B DR Opportunity Scanner | แยกหุ้นแม่/FX/ratio → ลดความเข้าใจผิด | P1/กลาง–สูง | DR candles+issuer ratio+underlying+FX; Starter+, premium analytics Pro | shared ingest+สิทธิหลายแหล่งยังไม่ทราบ | underlying/DR timestampsและratioครบก่อนpremium; missingFX/ratioต้องunavailable; source/schema tests |
| C MT5 Scanner/Risk Monitor | มอง positions/ความเสี่ยง Forex → retention | P1/สูง | owner MT5/Vantage export; Pro | snapshot50KiB/5min/8h×30≈0.137GiB/connection; broker/DBcostเพิ่ม | 2 owners isolated, no order endpoint, actual terminal/revoke/stale tests; indicatorsเรียกกฎเดิม |
| D Unified Portfolio | เปิดหลายแอป → overviewรายวัน | P1/สูง | Settrade+MT5 normalized owner data; Pro | network/storageตาม C; ราคาข้อมูล/FXยังต้องquote | ไม่รวมต่างสกุลถ้าไม่มีFX/เวลา; totals reconcileกับsourceและmissingไม่เป็น0 |
| E Broker Read-only | กังวลคีย์/สิทธิเทรด → trust/conversion | P0/สูง | adaptersเดิม; Free preview/Pro multi | secret management+sync, ไม่ใช่0เพราะลูกค้าจ่ายAPIเอง | read-only upstream, scope/owner, revoke/reconnect, no secrets in logs; real-account UAT |
| F Personal Watchlists | จำรายการไม่ได้ → activation | P1/ต่ำ–กลาง | favorites D1เดิม; ทุกtierใหม่ | ใช้ existing storage; limit/costตามusage | save/reload acrossdevices, legacy500ไม่หาย, duplicate/import-once/limitrace tests |
| G Smart Price/Strategy Alerts | เฝ้าจอ → first-useful-alert/conversion | P1/สูง | confirmed new bars + rules + opt-in delivery; Starter+ | budget0.50บาท/ผู้จ่าย/เดือนตั้งไว้ชั่วคราว; ช่องทางจริงต้องวัด | one event→one deliveryeffect, sourceage, planrecheck, quiet hours, retry/dedupe; no production sendsในaudit |
| H AI Portfolio Explanation | ไม่เข้าใจ exposure → perceived value | P1/กลาง–สูง | consented positions+verified metrics; Pro | basic budget0.10บาท/คำถาม; Research10บาท/คำถามในmodel | numeric facts trace to snapshot, owner isolation, missingdata refusal, prompt-injection/Thai evaluation |
| I Transparent Performance | ไม่เชื่อสถิติ → trust/retention | P0/สูง | signal events+ruleversion+replaycosts | DBhistory/exportsตามcapacity, no extra paidLLMจำเป็น | backtest/observed signals/brokerfillsแยก; costs+slippage+eventtime+no-lookahead regression |
| J Portfolio Risk/Exposure | ไม่เห็น concentration/margin → loss-prevention workflow | P1/สูง | actualpositions/currency/specs; Pro | deterministic math≈sharedcompute; private data C | totals reconcile, FXnotmissing, marginversion/asof, stress scenario labelled; no inventedStage/health |
| K Daily Briefing | ข่าวเยอะ → daily habit | P1/กลาง | licensed sharednews/candles; Starter+ | generate shared briefครั้งเดียว; AI/research10บาทต่อbriefเป็นbudgetไม่ใช่ต่อsubscriber | evidence/time per fact, unavailable-newsstate; sample review and duplicate-date test |
| L Weekly Reviews | ไม่ทบทวนพอร์ต → retention | P2/กลาง–สูง | ownerevents+consent+actualhistory; Pro | 4 basic summaries/month≈0.40บาทแบบจำลอง; researchเพิ่มแยก | per-owner/week, actualflowvsmarketP/L, opt-in/retry; no fabricatedreturn |
| M Multi-strategy Scanner | เทียบหลายแผน → expansion | P2/สูง | existing strategies/versions; Pro/Elite new tools | per-newbar incremental CPUต้องbenchmark | legacy output parity100%สำหรับsameinputs; no rule/version changes; shadow sink |
| N Custom Alert Builder | เงื่อนไขส่วนตัว → upgrade | P2/สูง | validated ruleDSL over authorizeddata; Elite | bounded evaluation+delivery quota | expression/timebudget/maxrules, owner+planpermissions, no arbitrary code/SQL, deterministic evaluation |
| O Portfolio Event Notifications | พลาดmargin/expiry/dividend → weekly use | P2/สูง | verified broker/issuer/event source; Pro/Elite | vendor events/notification quote unknown | eventidentity/time/scope, no unverifieddividend, dedupe+revoke, end-to-end deliverytest |
| P Billing Dashboard | ไม่เข้าใจสิทธิ/ตัดเงิน → trust and recovery | P0/กลาง | Stripe+existingD1; allmembers | official transactionfee+Billing; modelด้านล่าง | paid→rights, failed→paid-through, cancellation, duplicate/out-of-order, portalowner, noLive activation |

เรียงทำ: P0 trust/billing/data rights → A/B/F + overview → C/D/H/J/G → L/M/N/O
เก็บ US charts/scanner/history เดิมไว้ในทุก phase; ไม่ตั้ง “เพิ่มกลยุทธ์ใหม่” ก่อนพิสูจน์ legacy parity

## 4. Pricing และ entitlement matrix — ยังไม่เปิดใช้

ราคาตั้งต้นยังเป็นสมมติฐาน 0/99/299/599 บาท ชื่อ Elite ยังไม่แทน Ultimate ในระบบ
ข้อเสนอต่อไปนี้เป็น **commercial policy v2 สำหรับ cohort ที่อนุมัติใหม่เท่านั้น**
ผู้ใช้/แพ็กเกจเดิมต้องคงสิทธิที่มี การย้าย cohort หรือลดโควตาต้องตรวจผลกระทบและอนุมัติชัดเจน

| สิทธิใหม่ที่เสนอ | Free 0 | Starter 99 | Pro 299 (primary) | Elite 599 |
|---|---:|---:|---:|---:|
| งานหลัก | เริ่มติดตาม | shortlistรายวัน | พอร์ต+alerts+อธิบายความเสี่ยง | หลายพอร์ต+กฎส่วนตัว |
| shared Thai/DR/Forex | previewผลจริงที่เผยแพร่ได้ | dailyทั้งชุดที่มีสิทธิ | dailyเหมือนกัน | dailyเหมือนกัน |
| full-market scan ต่อsubscriber | 0 | 0 | 0 | 0 |
| Watchlist ใหม่ | 10 | 50 | 200 | 500 |
| broker connectionsใหม่ | 1 read-only | 1 | 3 | 5 |
| basic AI / เดือน | 3 | 80 | 250 | 600 |
| Research / เดือน | 0 | 0/add-on | 2 | 5 |
| AI daily burstเพดานเสนอ | 1 | 5 | 15 | 30 |
| active alert rules | 1 daily digest | 10 | 50 | 200 |
| deliveryเพดาน/วัน | 1 digest | 10 | 50 | 200 |
| personal evaluationเมื่อมีfeedใหม่ที่ใช้ได้ | daily | 30min | 5–15min | 1–5min |
| historyเพิ่มเติมที่มีสิทธิ/มีจริง | 30days | 6months | 24months | สูงสุดที่sourceอนุญาต |
| toolsใหม่ | watchlist | dailybrief | risk/exposure+weeklyreview | customrules+multiportfolio |

matrix นี้ไม่ซ่อน US หรือเอากลยุทธ์เก่าออกจากผู้ใช้เดิม และไม่รับประกัน history ที่ระบบไม่มี
AI basic คือโหมดอธิบายจากข้อมูลที่ส่งให้ซึ่งต้องสร้าง/ทดสอบเพิ่ม ไม่ใช่ Bigdata Research ที่มีต้นทุนเดียวกัน
ห้ามลดคุณภาพ/เปลี่ยน provider เดิมโดยเงียบ ๆ เพื่อให้ตัวเลขต้นทุนตรง model
การต่อ broker ช่วยเรื่องข้อมูลของเจ้าของ แต่ยังใช้ CPU/RAM/bandwidth/AI ของเรา

Trial เสนอ 14 วันแบบไม่บังคับบัตรใน policy v2 พร้อม cap ชัดเจน;
เงื่อนไข trial/portfolio เดิมต้องคงไว้จนอนุมัติการทดลอง cohort ใหม่
Annual discount เสนอ15% (ประมาณ1,010/3,050/6,110บาท/ปี) แต่รอหลักฐาน retention และ
annual billing implementation ที่แยกจาก monthly เดิม ไม่สร้าง Live prices ตอนนี้
Add-on Research เสนอ10ครั้ง/199บาท เฉพาะต้นทุนจริงคุมได้ใกล้budget10บาท/ครั้ง;
ถ้า p95 cost/quality ไม่ผ่าน ห้ามขายด้วยโควตานี้ ไม่มี overage charge อัตโนมัติ ลูกค้าต้องเลือกซื้อเอง

รายละเอียด engine, billing states, migration/rollback และทุก change-impact อยู่ใน
[architecture-and-change-plan.md](architecture-and-change-plan.md)

## 5. Shared-data architecture และสิ่งที่ต้องอนุมัติก่อนเพิ่มรอบ

คง shared daily dataset + scanners เดิม เพิ่ม event layer และ personal evaluation ภายหลัง
ไม่ทำ full-market job แยกต่อ subscriber ไม่เปลี่ยน closed-bar rules เพื่อให้ผลออกเร็วขึ้น
raw refresh, strategy calculation, personal evaluation และ frontend refresh ต้องเป็นคนละค่า
ใช้ source contract+market calendar+provider quota เป็นข้อกำหนดก่อนเปิด 5min/1min
read-only broker data ต้องไม่กลายเป็น shared delayed data ของ SaaS
job lease/checkpoint/fencing เดิมยังใช้ต่อ; เพิ่ม queue/backpressure/metrics โดยไม่เขียนทับประวัติ

## 6. Infrastructure cost และ capacity

**KVM2 เหมาะกว่าสำหรับซื้อใหม่ใช้ระยะยาว; KVM1 เดิมยังใช้ต่อช่วงเริ่มต้นได้**
วัดเครื่องเดิมได้ RAMใช้ประมาณ2.1/4GB และ availableประมาณ1.8GB;
ใช้ค่าขณะพัก/ทดสอบเฉพาะช่วง ไม่ได้ certify concurrency

| สเปก/ราคาเว็บทางการที่ตรวจ | KVM1 | KVM2 |
|---|---:|---:|
| vCPU / RAM / NVMe | 1 / 4GB / 50GB | 2 / 8GB / 100GB |
| ราคาโปรเฉลี่ยเดือน | 209บาท | 269บาท |
| ราคาต่ออายุเฉลี่ยเดือน | 349บาท | 419บาท |

ส่วนต่างโปร60บาท/เดือน ต่ออายุ70บาท ราคานี้เป็นค่าเฉลี่ยแพ็กเกจชำระล่วงหน้า
ยอด upgrade บัญชีเดิม/ภาษี/ระยะสัญญาต้องดู hPanel เมื่อจะซื้อจริง โดยคำนึงว่าอาจย้ายprovider
Docker appปัจจุบันยัง cap768MiB/0.65CPU ซื้อเครื่องใหญ่ขึ้นไม่ได้เพิ่ม container limits อัตโนมัติ
[Hostinger ราคาและสเปก](https://www.hostinger.com/th/vps-hosting)

### แบบจำลองโหลด ไม่ใช่ผล benchmark

นิยามแถวนี้เป็นผู้เปิดดูพร้อมกันวันละ2ชั่วโมง ต่างจาก MAU ในแบบจำลองการขาย
สมมติคนละ6APIcalls/นาที, JSON20KiB,3gatewaycalls/API,8D1rowsread/API,
1logicalwrite/API×indexfactor2, serverCPU3–15ms/API, gatewayCPU2ms,edge0.5ms
ทั้งหมดเป็นสมมติฐานที่ต้องแทนด้วยmeasurement รวมassets/scan/cleanup/AI/storageภายหลัง

| Concurrent viewers | API RPS | API CPU coresประมาณ | JSON GiB/เดือน | Workers requests/วัน | D1 writes/วัน | Workers+D1งบPaid/เดือน |
|---|---:|---:|---:|---:|---:|---:|
| 100 | 10 | 0.03–0.15 | 41 | 288,000 | 144,000 | 175บาท |
| 500 | 50 | 0.15–0.75 | 206 | 1,440,000 | 720,000 | 552บาท |
| 1,000 | 100 | 0.30–1.50 | 412 | 2,880,000 | 1,440,000 | 1,054บาท |
| 5,000 | 500 | 1.50–7.50 | 2,060 | 14,400,000 | 7,200,000 | 10,886บาท |

RAM mathในcost-model.jsonให้lower-boundประมาณ2.11/2.13/2.15/2.37GiB จากbaseline+
inflight+idleconnectionsเท่านั้น **ไม่ใช่ allocationที่พอจริง** เพราะไม่รวมGC/SSR/nativebuffers/
slowproviders/scannerburst การวาง stagingควรทดลอง4–8GBที่100,8GBที่500,
8–16GBที่1000และหลายworker/16–32GBที่5000 แล้วเลือกจากRSS/CPU/queueจริง
5,000 concurrent ไม่มีหลักฐานว่า KVM2เครื่องเดียวพอ

Workers Freeมี100,000requests/วัน และD1Freeมี5ล้านreads/100,000writesต่อวัน
ดังนั้นย้ายNext.jsไปVPSแก้CPUต่อinvocation แต่ไม่ทำให้gateway/D1ไม่มีquota
ตารางนี้แสดงสมมติฐานที่เกินFreeตั้งแต่100concurrent อย่าอ่านเป็นจำนวนผู้ใช้จริงที่รับได้สูงสุด
ยังไม่ได้สมัครPaid; งบ175บาทคิดจาก$5×35เป็นplanning reserve
[Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/)

### Benchmark procedureที่ต้องทำก่อนรับรอง

stagingใช้fixtureข้อมูลที่ระบุsyntheticและproviderstub ไม่มีcustomerDB/realpaidAPI
ทดสอบ100→500→1000→5000, ramp5นาที/level,hold10นาที,soak60นาทีที่ระดับเป้าหมาย,
ทดสอบพร้อมscanner/AIqueue/outage429/restart; แยกAPIsteadyloadกับfullpagerender
เก็บp50/p95/p99,RPS,error,CPU/RSS,eventlooplag,D1meta,cachehit,queueage,cost
เกณฑ์เสนอp95<1.5s,p99<3s,error<1%,CPUsteady<70%,memory<75%,zeroownerleaks,
ไม่รันfullscanต่อuserและไม่มีduplicateeventeffect
**ยังไม่ได้executebenchmarkเหล่านี้**; ไม่มีตัวเลขผ่าน/ไม่ผ่านที่แต่งขึ้น

## 7. UI/UX specification และ conversion journey

เป้าหมายหน้าแรก: “วันนี้ต้องติดตามอะไรในหุ้นไทย DR และพอร์ต Forex ของฉัน”
แสดงsourceage/coverageก่อนคะแนนชวนเชื่อ ใช้premiumvisualsystemโดยไม่ย้าย/ลบrouteเก่า
สีบวก/ลบใช้กับตัวเลขที่มีข้อมูลจริงเท่านั้น; tokensกลางสำหรับspacing/type/state;
ไม่ทำแต่skinกราฟเพิ่มเมนูจนลูกค้าไม่เห็นงานสำคัญ

| Navigationเสนอ | นำของเดิมมาใช้ / การเปลี่ยนที่เสนอ |
|---|---|
| Overview | เพิ่มpreviewroute `/overview-v2` หลังflag defaultoff: dailybrief,watchlistchanges,portfoliohealthที่verified |
| หุ้นไทย | คง `/thai` และสัญญาณเดิม; defaultfocus+daily timestamp |
| DR | คง `/dr` และ `/dr-strategy`; แยกหุ้นแม่/FX/ratioตามsource |
| Forex | คง `/forex`; แยกpublicreferenceจากprivateMT5และสถานะเชื่อมต่อ |
| พอร์ตของฉัน | เสนอหน้าnormalizedview; คงendpointsและholdingsเดิม |
| Scanner | ใช้ `/shared` + savedsignalfilters ไม่เริ่มfullscan |
| Watchlist | existingfavoritesD1; เสนอviewใหม่ ไม่ลบรายการเกินnewlimit |
| Alerts | เสนอrules/deliverystate;ไม่อ้างmanualTelegramเป็นsmartalerts |
| AI Assistant | existing `/api/assistant`; แสดงResearch/basic/provider/remainingquotaก่อนถาม |
| Strategy Performance | อ่านevent/versionเดิม;backtest/observed/brokerfillคนละแท็บ |
| Subscription | ใช้accountbilling/Stripeportalเดิม;ชี้ชัดTestจนLiveผ่าน |
| Settings | คง `/account`;consent/connections/notificationsเพิ่มหลังreview |
| ตลาดเพิ่มเติม | US `/us` และTFEX `/tfex` ยังเข้าถึง/deeplinkได้ ไม่ลบฟังก์ชัน |

desktopใช้sidebarแบบกลุ่ม งานประจำ→ตลาด→บัญชี mobileใช้4–5primarydestinations+
เมนูทั้งหมด ไม่ซ่อนสถานะdataหรือเวลาข้างใต้hover ใช้คีย์บอร์ดได้/labelครบ/touchtarget44px
empty/loading/stale/error/demo/privateต้องแยกชัด;Unavailableไม่แสดงเป็น0หรือcodeerrorดิบ
sidebarbadgeการเชื่อมต่อไม่แปลว่าdataสดถ้าtimestampเก่า

Funnelเสนอ: Visitorเห็นตัวอย่างผลจริงที่มีสิทธิ→LINE/Free→savewatchlistแรก→
ดูเหตุผลหนึ่งรายการ→รับusefulalertหลังopt-in→read-onlyportfolioconnection→Pro→weeklyreview
กฎtrial/สิทธิเดิมยังใช้เหมือนเดิม; การปลดล็อกFree/เปลี่ยนportfolioonboardingเป็นการทดลองใหม่ต้องapprove
Contextualupgradeอธิบายฟีเจอร์ใหม่และข้อจำกัดจริง ไม่สร้างfakecountdownหรือซ่อนcancel

eventsเสนอ: signup_completed,watchlist_first_saved,brief_opened,alert_rule_created,
useful_alert_opened,broker_connected,checkout_started,invoice_paid,entitlement_granted,
weekly_review_opened,cancel_reason บันทึกeventmetadataที่ไม่เผยคีย์/เลขบัญชี/positions
conversion,churn,activationและretentionยังไม่มีcohortdata;ตัวเลขในmodelเป็นสมมติฐานทั้งหมด

## 8. Financial model และ sustainable margin

[เครื่องคำนวณปรับสมมติฐาน](financial-calculator.html) และ [ตัวเลข/สมมติฐานครบ](cost-model.json)
สูตรผ่านreconciliation,zero-revenue,invalidmix,higherAIcost,higherlicenseและVATsensitivitychecks
ยังไม่ได้ตรวจภาพเบราว์เซอร์ของเครื่องคำนวณ;ไม่ใช่ระบบตั้งค่าbillingจริง

### AIหนึ่งคำถาม

BigdataResearchตัวอย่างจริง1ครั้งเมื่อ24ต.ค.ใช้ประมาณ$0.1125136≈3.94บาทที่FX35
เป็นตัวอย่างจากusage/accountdeltaซึ่งอาจมีrounding/concurrentusage ไม่ใช่averageหรือราคาตายตัว
freecreditsไม่ใช่แหล่งทุนถาวร จึงไม่ใช้ยอดเครดิตฟรีมาทำให้grossmarginดูดี

หากคำถามทุกครั้งแพงเท่าตัวอย่าง โควตาปัจจุบัน10/50/150ต่อวันจะเป็น300/1500/4500ครั้งใน30วัน
ต้นทุนประมาณ1,181/5,907/17,721บาท เทียบราคาขาย99/299/599บาทก่อนค่ารับเงินและระบบอื่น
จึงไม่ควรเพิ่มผู้ใช้หรือขายunlimitedResearchก่อนมีactualcostledgerและbudgetpolicyที่อนุมัติ

ราคาtokenอย่างเดียวสำหรับสมมติ2,000input+1,000outputรวมreasoning,FX35:

| Candidate / ยังไม่เปลี่ยนprovider | USD ต่อ1Minput/output | บาท/คำถามตัวอย่าง |
|---|---:|---:|
| [OpenAI GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) | 0.10 / 0.50 | 0.0245 |
| [Gemini3.1Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing) | 0.25 / 1.50 | 0.0700 |
| [Cloudflare Llama3.3 70B](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) | 0.293 / 2.253 | 0.0994 |

ข้อมูลOpenAIใช้official OpenAI documentationในการตรวจราคา เปรียบเทียบนี้ไม่รวมsearch/
licensedcontent/agentloops/embedding/taxesและไม่ได้แปลว่ามีคุณภาพ/coverageเท่าResearchAgent
ก่อนเปลี่ยนproviderต้องมีThai/DR/Forexevaluationอย่างน้อย50casesพร้อมcitations/missingdata/
numericfaithfulnessและlatency/costp50/p95 ไม่มีการสลับproviderในรอบนี้
WorkersAIมีdailyfreeallocation10,000neuronsซึ่งหมดแล้วคำขออาจfail ต้องเผื่องบ/การรับมือquota
[WorkersAIpricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

### Modelสำหรับpolicyv2ที่เสนอ ไม่ใช่ผลจริง

mixStarter40%/Pro50%/Elite10% → ARPPU249บาท ใช้ราคา99/299/599;
ต้นทุนbasicbudget0.10บาท/คำถาม,Researchbudget10บาท/คำถาม;free3basic/monthใช้เฉลี่ย10%quota
งบVPS419,backup200,observability100,Workersเริ่ม175บาทตามPaidplanningrate
licenseprovision15,000บาทเป็น**สมมติฐาน** ไม่ใช่ราคาredistributionที่SETเสนอให้ธุรกิจนี้
ค่ารับบัตรในประเทศ3.65%+10บาท และBilling0.7%ตามหน้าStripe;
เพิ่มVATfees7%เป็นassumption หากขอคืนภาษีได้ต้องปรับ model;VATยอดขายตั้ง0เป็นassumptionที่ปรับได้
[StripeThai pricing](https://stripe.com/th/pricing)

| ต่อเดือน | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| MAU / conversion | 500 / 3% | 1,000 / 6% | 5,000 / 10% |
| ผู้จ่าย | 15 | 60 | 500 |
| MRR | 3,735 | 14,940 | 124,500 |
| Gross profitหลังCOGS | -12,891 | -3,255 | 91,488 |
| Gross margin | -345.1% | -21.8% | 73.5% |
| Monthly churnสมมติ | 10% | 6% | 3% |
| CACสมมติ | 600 | 350 | 250 |
| Gross-margin LTVโดยสูตรย่อ | ยังใช้ไม่ได้marginติดลบ | ยังใช้ไม่ได้marginติดลบ | ประมาณ6,099 |
| คุ้มทุนCOGSจำนวนผู้จ่าย | 80 | 76 | 76 |
| คุ้มทุนรวมOPEX/acquisition | 119 | 124 | 157 |
| Operatingresultก่อนengineering/ภาษีอื่น | -20,891 | -13,505 | 73,988 |

สูตร:MRR=paid×ARPPU;COGS=paymentfees+AI+delivery+hosting/DB/backup+licenseprovision;
grossmargin=(netrevenue-COGS)/netrevenue;LTV≈ARPPU×positivegrossmargin/monthlychurn
เป็นsteady-stateheuristicไม่ใช่cohortDCF;หากgrossmargin≤0ไม่คำนวณLTVบวกให้ชวนเชื่อ
CAC=newacquisitionexpense/newpaid;modelตั้งnewpaid5/15/50ต่อเดือนและsupportoperations5,000บาท
churn/retention/conversionไม่ได้วัดจากลูกค้าจริง ไม่มีการรับรองยอดขายหรือกำไร

ในBaseหากlicenseprovision0/5,000/15,000/30,000บาท จุดคุ้มทุนCOGS≈5/29/76/147ผู้จ่าย
กรณี0เป็นเพียงsensitivityเมื่อมีสิทธิข้อมูลที่พิสูจน์ว่าไม่เสียเงินเพิ่ม ไม่ใช่ใบอนุญาตใช้ข้อมูลฟรี
ส่วนต่างKVM1→2เพียง60–70บาทต่อเดือนเล็กกว่าความเสี่ยงข้อมูล/Researchมาก
แนะนำเริ่มขายคุณค่าProหลังP0ผ่าน ทดสอบcohortเล็กและคงlegacyสิทธิ แทนเพิ่มquotaAIเพื่อจูงใจ

## 9. Implementation tasks/dependencies และเกณฑ์อนุมัติ

รายการละเอียดอยู่ [architecture-and-change-plan.md](architecture-and-change-plan.md)
แต่ละงานระบุ behaviorเดิม→สิ่งใหม่→สิ่งที่คงไว้→compatibility→approval→tests/rollbackครบ
ใช้additive/versionedcatalogและflagsdefaultfalse;ไม่มีmigrationที่dropหรือupdateสิทธิเดิมในรอบนี้
priorities:แก้unverifiedportfoliooutputsแบบpatchแยก,Testbillingdelivery,LINEhumanacceptance,
sourcecontractsและAIcostbaseline ก่อนUXrolloutหรือintraday
งานแก้สูตร/เปลี่ยนruleversion/ลดสิทธิ/เปลี่ยนscanfrequencyต้องได้รับexplicitapproval
ไม่mergeDraftPRหรือเปิดpaidbilling/tradingจากการส่งรายงานนี้

## 10. Test results / production readiness

| Check | ผลที่บันทึก | ข้อจำกัด |
|---|---|---|
| Automated suite | 458ผ่าน/0fail | unit/integrationหลายส่วนใช้fixtures;ไม่ใช่loadtest |
| NativeD1gatewaybatch | authorization,commitและrollbackผ่าน | ไม่ใช่restoreDRทุกข้อมูล |
| Sessioncontinuity | ผ่านcutover/guestisolation | humanLINEnewconsentยังไม่ผ่าน |
| Demo6roles | ผ่านAPI/rightsครบ | ไม่ใช่สิทธิจากLiveinvoice |
| Shared5marketAPIs | HTTP200และsource/timesครบในavailableแถว | savedseriesไม่ได้หมายถึงสดทุกแถว |
| Dailyread-onlypolicy | guest403/manualsharedrescan409 | personaluniversalbrokerยังไม่มี |
| LINEstart | redirect/callbackURLตรง | ต้องคนจริงทดสอบต่อ |
| StripeTestCheckout | เปิดhostedcheckoutHTTP200,ไม่submitเงิน | webhookpaid→rights/renewalยังpending |
| WorkersAI | transport+JSONschemaผ่านจริงหนึ่งครั้ง | ไม่ได้ประเมินThaiquality/costdistribution |
| Fullpagebrowserlatest | **ยังไม่รันสำเร็จ** | automaticapprovalreviewแจ้งworkspaceoutofcredits;ไม่bypass |
| 100/500/1000/5000benchmark | **ยังไม่รัน** | ตารางcapacityเป็นสมมติฐานและมีprotocolรอ |
| RealSettrade/MT5customer | **ยังไม่ยืนยัน** | source+fixtureverificationเท่านั้นในรอบนี้ |
| Feedredistribution/SECboundary | **รอเอกสาร/ผู้เชี่ยวชาญทบทวน** | ไม่ใช้configbooleanแทนสิทธิ |

**สถานะพร้อมขาย: NO-GO จนP0ผ่าน**;พร้อมใช้Demo/ทบทวนระบบภายในตามขอบเขตที่มี
การไม่เปิดLiveไม่ขัดกับเป้าหมายขาย แต่ป้องกันรับเงินแล้วสิทธิไม่ทำงานหรือให้ข้อมูลที่อ้างเกินหลักฐาน

งานรอบนี้ส่งมอบcurrentaudit,competitorgaps,featurepriorities,pricingmatrix,
architecture,capacity/costmodel,UXspec,financialscenarios,tasks/dependenciesและreadinessreport
ทุกส่วนเป็นระยะ0และข้อเสนอ ไม่ใช่คำอ้างว่าphases1–5ถูกimplementแล้ว

Draftงานก่อนaudit: [PR#5](https://github.com/nuibhr/market-signal-workspace/pull/5)
ยังเป็นdraftไม่merge;การตรวจครั้งถัดไปให้ใช้baselineและchange-impactplanนี้เป็นสัญญาร่วมกัน
