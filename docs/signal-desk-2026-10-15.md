# ระบบสัญญาณหุ้น Swing Standard — 15 ตุลาคม 2026

เพิ่มระบบสัญญาณสำหรับหุ้นไทย/DR/US/ETF ในหน้าตลาดเดิมแล้ว ครอบคลุมสแกน, watchlist, แผนรอยืนยัน, ติดตาม Entry/TP1/BE/trail/Stop, ประวัติผล และ replay ตามข้อมูลที่มี **ไม่มีการเชื่อมพอร์ตหุ้น ยอดเงิน จำนวนหุ้นของลูกค้า หรือส่งคำสั่งซื้อขาย** Forex/MT5 ใช้ระบบเดิม

งานนี้ต่อจาก `f5bb927` เปลี่ยนขอบเขตจากการรอ backtest ครบ 3 ปีเป็นระบบสัญญาณเดินหน้าพร้อมผลวิจัยตามช่วงข้อมูลจริง ไม่รับรองอัตราชนะหรือความแม่นยำจากการที่โค้ด/build ผ่าน

## วิธีใช้

1. เปิด `/thai`, `/dr` หรือ `/us` แล้วเข้าสู่ระบบสมาชิกตามสิทธิเดิม ส่วน **สแกนและติดตามสัญญาณ** อยู่บนหน้าตลาด ทางลัด Scanner/สัญญาณพาไปตารางชุดนี้
2. เลือก Breakout/Pullback ค้นหา symbol หรือเลือกเฉพาะหุ้นโปรด ปุ่มดาวใช้ watchlist ตามบัญชี LINE เดิม
3. **สแกน 6 ตัวในหน้านี้** อ่านแหล่งข้อมูลจริงแบบจำกัดจำนวน ส่วน worker ตรวจรายชื่อเต็มต่อเนื่องและบันทึกความคืบหน้าข้ามการ restart การสแกนครบรายชื่อไม่หมายความว่าต้องมี setup ผ่านทุกวัน
4. US/ETF ต้องกรอกคอม/ค่าธรรมเนียม/VAT บนคอม/slippage เป็นเปอร์เซ็นต์ต่อข้างครบทั้ง 4 ช่องก่อนสร้างแผน ค่าศูนย์ต้องกรอกเอง ไม่มีการใช้คอมไทยแทน รองรับเฉพาะต้นทุนเปอร์เซ็นต์ ไม่รองรับ fixed/minimum fees หรือ FX cash flows
5. ป้าย **ผ่านเกณฑ์ · รอยืนยันเข้า** ยังไม่ใช่ ENTRY ให้ดูแผนที่เผยแพร่แล้วและเหตุการณ์เข้าเงื่อนไขหลังเผยแพร่ ราคาทั้งหมดเป็นราคาอ้างอิงของระบบ พร้อมเวลาแท่งและเวลาที่ระบบยืนยัน
6. เปิดเสียงโดยกดปุ่มในหน้า ป๊อปอัป/เสียงทำงานขณะเปิดหน้านี้ เลือกเฉพาะหุ้นโปรดเพื่อกรองการแจ้งเตือนได้ **ยังไม่มี push เมื่อปิดเว็บ**
7. กด **ทดสอบช่วงที่มี** เพื่อ replay ของ symbol นั้นด้วยกติกาเดียวกับ forward signal แสดงช่วงเวลา จำนวนแท่ง และผลแยกสอง entry mode ไม่รวมสถิติย้อนหลังกับผลเดินหน้า

## สิ่งที่เชื่อมแล้ว

| ส่วน | พฤติกรรม |
| --- | --- |
| ภาพรวมตลาด | เวลาไทย, SET Index/% เปลี่ยนจาก Yahoo ticker `^SET.BK` ที่ตรวจว่าเป็น INDEX/THB/SET, ราคาเก่าอย่างน้อย 15 นาที พร้อม timestamp; marketState เป็นสถานะตามผู้ให้ข้อมูล อาจรวมเวลาพักระหว่างวัน ไม่อ้างเป็นการตรวจวันหยุดอย่างอิสระ |
| ตารางสแกน | Symbol/ชื่อ, ราคา/% เทียบปิด 4H ก่อนหน้า, swing support/daily resistance, entry/เงื่อนไข, structural Stop/เป้า 2R/ระยะ R ถึงแนวต้าน, ATR/ATR%, Volume/RVOL, RSI และแนวโน้ม D1/4H, สถานะและเหตุผล, ปุ่มดาวและ replay |
| สถานะสัญญาณ | WAITING → OPEN → RUNNER → CLOSED/STOP; EXPIRED หากไม่เข้า, REVIEW หากข้อมูลขาด/ลำดับราคาไม่ชัด แสดงราคาเข้าอ้างอิง/ล่าสุด, Stop/TP, ระยะ %/ATR, สัดส่วนที่เหลือและผลอ้างอิง %/R ไม่มีมูลค่าเงินจริงของลูกค้า |
| แจ้งเตือน | PICK_READY, ENTRY, TARGET, STOP/EXIT, ใกล้ Stop ≤0.5 ATR, เลื่อน Stop, DATA_GAP/AMBIGUOUS/EXPIRED; event ledger ถาวรและ cursor catch-up ข้าม reload; ใช้ browser locks ป้องกันแท็บแย่งคิว คำตอบช้าไม่ย้อน cursor |
| Journal | บันทึกเวลาเผยแพร่/เข้า/ยืนยัน/ออก, ราคาและสัดส่วน partial exits, ผลสุทธิ %/R และต้นทุนที่ตรึงไว้ตอนสร้างแผน ไม่ดึงประวัติเทรดจาก broker |
| สถิติ | Win rate, expectancy R, PF บนฐานเริ่มเสี่ยงเท่ากัน 1R/สัญญาณ และ max drawdown สะสมจากไม้ปิดหน่วย R แยก entry mode/รุ่นกติกา/ชุดต้นทุน ไม่มีการแปลงเป็น % drawdown ของพอร์ตลูกค้า |
| ต้นทุน US ที่เปลี่ยน | แผนเก่าคงต้นทุนเดิมและยังติดตาม/แจ้งเตือนต่อ สมาชิกอื่นไม่เห็นชุดต้นทุนของกันและกัน ประวัติเดิมยังแสดง ส่วนสถิติแสดงเฉพาะชุดต้นทุนปัจจุบันเพื่อไม่รวมกรณีต้นทุนต่างกัน |
| รุ่นเดิม | เก็บ ORB/EOD ledger เดิมไว้ในหัวข้อประวัติแยก หยุด worker รุ่นเดิมในเครื่อง เปลี่ยน `autopick:worker` ให้เริ่ม Swing worker แทน |

ตัด Entry/Stop/TP ของ Pivot/technical-plan รุ่นเดิมออกจากหน้าหุ้นและกราฟ เพื่อไม่ให้แสดงสองแผนขัดกัน แนวรับ–แนวต้าน Pivot และอินดิเคเตอร์ยังดูประกอบได้ ตาราง Swing เป็นแหล่งแผนของระบบชุดเดียว

## กติกาของรุ่น `swing-standard-forward-v1`

- ใช้แท่งปิด D1/4H ที่พร้อมมาแล้วอย่างน้อย 15 นาที ต้องมีประวัติอย่างน้อย 55 แท่งของแต่ละ frame สำหรับ EMA/ATR/structure ไม่บังคับข้อมูล 3 ปีสำหรับการสร้างสัญญาณเดินหน้า
- D1 ขาขึ้นจาก EMA20/EMA50 และราคาปิดเหนือ EMA20; Breakout ใช้ปิดเหนือ high 20 แท่ง 4H ก่อนหน้า; Pullback แตะ EMA20 แล้วปิดเขียวกลับเหนือ EMA และ high แท่งก่อนหน้า เป็นพารามิเตอร์ Standard ที่ใช้วิจัยและเดินหน้าในรุ่นนี้
- Swing ต้องมีแท่งด้านขวายืนยันสองแท่ง ใช้ Wilder ATR14 ของ 4H; Stop = swing low −1×ATR ปัดลงตาม tick ของระดับราคานั้น ข้ามหาก Stop กว้างเกิน 8% ไม่ย้าย Stop เข้าหา entry เพื่อแต่ง R:R
- เป้า TP1 คำนวณให้ถึง 2R หลังคอม/fee/VAT/slippage ของแผน หากแนวต้านอยู่ก่อนเป้าให้ไม่ผ่านเกณฑ์ พร้อมแสดง R ที่เหลือถึงแนวต้าน ไม่มีเพดาน TP 1%/4% ตายตัว
- RVOL เปรียบเทียบกับแท่งช่วงตลาดเดียวกันสูงสุด 20 แท่ง ต้องมีตัวเทียบอย่างน้อย 5 แท่งและ RVOL ≥1 Native 4H ของ Settrade อาจเลื่อนชั่วโมงเริ่มแท่ง จึงใช้ช่วงตลาดท้องถิ่น; US ใช้ 09:30/13:30 New York แยกกัน รวม DST
- เผยแพร่แผนแล้วรอแท่ง 15m ที่เริ่มภายหลังเวลาเผยแพร่ ปิดเขียวเหนือราคาแผน โดยไม่ไล่เกิน 0.5 ATR และมี Volume >0 จึงออก ENTRY ราคาอ้างอิงจาก close ของแท่งนั้น เก็บเวลา close และเวลายืนยันหลังข้อมูลดีเลย์แยกกัน ไม่ถือเป็น broker fill และไม่ใช้ high/low ก่อนเข้าไปตัดสิน TP/SL
- หากพบแท่งเข้าช้าเกิน 45 นาทีให้หมดอายุแทนการประกาศ entry เก่าย้อนหลัง Waiting หมดอายุ 24 ชั่วโมง; OPEN/RUNNER ถือข้ามวันตามกติกาจนจบแผน
- TP1 2R ปิดอ้างอิง 50% แล้วเลื่อนอีก 50% ไป breakeven รวมต้นทุน Trail ตาม confirmed swing support − ATR ที่พร้อมก่อนแท่ง execution นั้น Stop เลื่อนขึ้นเท่านั้น
- Gap ผ่าน Stop ใช้ราคา open ที่เสียเปรียบ ไม่ทำเสมือนออกได้ที่ Stop เดิม กรณีแท่งเดียวแตะ Stop/TP หรือ TP1/Stop ใหม่โดยไม่รู้ลำดับพัก REVIEW กรณี open ข้าม TP แก้ลำดับได้ว่า TP เกิดก่อน low ภายในแท่ง
- แท่ง Volume 0 ไม่ยืนยัน entry/fill เมื่อช่องว่างอยู่ในช่วงตลาดปกติให้ REVIEW แทนการเดาผล ตลาดพักกลางวัน/กลางคืน/สุดสัปดาห์ไม่ถือเป็นช่องว่างปกติ แต่ยังไม่มี holiday calendar ครบ จึงอาจต้อง REVIEW ในวันหยุดจริง
- ผลปิดนับเมื่อปิดครบเท่านั้น TP1 ครึ่งหนึ่งที่ 2R แล้วอีกครึ่งที่ BE ได้ประมาณ 1R ของทั้งไม้ ไม่ใช่สองไม้ชนะ; ส่วนที่ยังเปิดและ REVIEW ไม่นับ win rate/PF/expectancy ปิด

Tick หุ้นไทย/DR ใช้ตารางตาม [SET price bands and tick sizes](https://www.set.or.th/en/market/information/trading-procedure/price-bands-and-tick-sizes) และปัดแต่ละราคาตามระดับปลายทางเพื่อรองรับเป้าข้ามขั้นราคา เวลาพัก/ช่วงตลาดอิง [SET trading hours](https://www.set.or.th/en/market/information/trading-procedure/trading-hours) โดยไม่ถือว่าตารางเวลารายสัปดาห์ยืนยันวันหยุดหรือการหยุดซื้อขายรายตัว

ค่าคอมไทย/DR 0.06% ต่อข้าง, market fee สมมติ 0.005%, VAT 7% บนคอม, slippage ไทยใหญ่ 0.15%/mai 0.4%, DR 0.3% ต่อข้าง ค่า fee ของ DR ที่ใช้ตาม preset ไทยยังเป็นสมมติฐาน ไม่ถือว่า broker ยืนยันว่ารวมค่าธรรมเนียมทุกอย่าง แสดงต้นทุนในแผน ผลอ้างอิงไม่รวมปันผล/FX/ค่าธรรมเนียมขั้นต่ำ

## ข้อมูลและการประมวลผล

- หลักไทย/DR: Settrade D1/4H; สำรอง Yahoo ticker `.BK` ของ DR/หุ้นตัวเดียวกัน ห้ามเอา underlying ต่างประเทศมาสวมชื่อ DR
- US/ETF: Yahoo ticker/ชนิด EQUITY หรือ ETF จริง สร้าง 4H จาก constituent 1H ของ session จริง; ไม่มีแท่งชั่วโมงที่ขาดจะไม่เติมราคาให้ครบ Tail session ใช้แท่งที่มีจริง (US 13:30–16:00 มี 3 hourly buckets) และรอขอบเขต 4H เต็มอย่างระมัดระวัง จึงอาจดีเลย์เพิ่มจากเวลาปิดจริง
- เก็บข้อมูล/quote สำรองทั่วไปเป็น chart-only เช่นเดิม Pipeline ใหม่ใช้เฉพาะแท่งที่ผ่าน availability lag เพื่อสร้าง **forward reference signal** ที่รอการยืนยันหลังเผยแพร่ ไม่มีการเปลี่ยน flag กราฟเก่าให้เปิดการเข้าเก่าย้อนหลัง
- SET overview เก็บเฉพาะตัวอย่างราคา index สาธารณะใน namespace ของ `provider_cache` แยกจาก candle cache เลือกตัวอย่างที่เวลาเก่า ≥15 นาที; ไม่เก็บ user quote/session/portfolio หาก index ไม่พร้อมแสดง unavailable ไม่มีการแทนด้วยหุ้นหรือดัชนีอื่น
- Worker ใช้ lease ต่อ market, checkpoint ต่อ symbol, จำกัดงานต่อรอบ, ให้ส่วนหนึ่งกับ monitoring และอีกส่วนกับรายชื่อที่ยังไม่สแกน เพื่อไม่ให้กลับไปเริ่มตัวแรกหลัง restart หรือให้แผนเปิดกิน budget ทั้งหมด
- รายชื่อไทย 150, DR 141, US/ETF 600 ตรวจแบบ batch ไม่ใช่ทุกตัวพร้อมกันทุกนาที หน้าแสดง expected/observed/available/unavailable/never checked จริง ผลสแกนไทย/DR เกิน 20 นาทีหรือ US เกิน 60 นาทีพักเป็น stale แม้ยังเก็บราคาเก่าไว้
- เปลี่ยนจากหน้าต่าง ORB รอบเช้าเป็นสแกน Swing ต่อเนื่อง ไม่ย้อนซ่อม signal ของรอบที่เครื่องเคยพลาด

## หลักฐานจากข้อมูลจริง

Snapshot **15 ต.ค. 2026 เวลา 13:18 น. กรุงเทพฯ** (`2026-10-15T06:18:25.852Z`):

| ตลาด | รายชื่อ | ตรวจแล้ว | Source พร้อม |
| --- | ---: | ---: | ---: |
| หุ้นไทย | 150 | 150 | 144 |
| DR | 141 | 141 | 113 |
| US/ETF | 600 | 332 | 331 |

US ยังไล่ตรวจรายชื่อที่เหลือต่อ ข้อมูลไม่พร้อมมีทั้งประวัติ D1/4H สั้นกว่า 55 แท่ง, ราคาเก่า และ provider unavailable จึงไม่ตีความว่า symbol ทุกตัวมีแผนพร้อมเทรด

พบแผน DR Breakout จริง 1 แผน: **SPHLTH80 สถานะ WAITING** เผยแพร่ 13:06 น. มีราคาแผนอ้างอิง 5.90 / Stop 5.65 / TP1 6.55 และความกว้าง Stop ประมาณ 4.52% ณ snapshot มีเพียง PICK_READY ยังไม่มี ENTRY/ผลปิด เป็นหลักฐานว่า pipeline สร้างแผนจากฟีดและบันทึกลง ledger ได้ ไม่ใช่คำยืนยันให้ซื้อหรือผลทดสอบกำไร

Probe อ่าน SCB, AAPL80, SPY ได้จริงทั้ง D1/4H พร้อม ATR/RSI/RVOL และลอง SCB replay ช่วง **22 ก.ย.–15 ต.ค. 2026** จาก D1 727 / 4H 483 / 15m 379 แท่ง ได้ 0 แผนผ่านในทั้งสองโหมด จึงคืนสถิติปิดเป็น null ไม่สร้างผลชนะเติมให้ครบจำนวน ไม่มีการยืนยัน coverage ทั้ง session/corporate actions หรือความสามารถทำกำไรจาก sample นี้

## การตรวจและขอบเขตที่ยังไม่รับรอง

- ชุดรวม **222 tests**: regression เดิม 200 และสัญญาณใหม่ 22 รวม causal inputs, entry หลังเผยแพร่, zero-volume, net-R/tick, partial/BE/trail/gap/ambiguity, immutable journal/CAS retry, US cost isolation/history, leases/roster continuation, Cloud job coalescing, native D1 migration/lifecycle, cursor reload/cross-tab และ SET identity
- Anonymous HTTP smoke **57/57** เพิ่ม guards ของ `/api/signals`; ไม่สร้าง session หรือสมาชิกทดสอบในฐานจริง
- Next build, Cloud web build และ scanner `wrangler deploy --dry-run` ผ่าน ไม่มีการ deploy สู่ public hosting
- Fixtures ใช้ฐานชั่วคราวของ SQLite/native D1 ข้อมูลที่บันทึกในฐานใช้งานจริงรอบนี้เป็นราคา/แผนจาก provider เท่านั้น ไม่มีการเพิ่ม customer test trades
- Browser automation localhost ยังมีข้อจำกัดตามรอบก่อน จึงไม่มีการอ้างว่า signed-in click flow, มือถือหรือเสียงอุปกรณ์จริงผ่าน acceptance แล้ว Source/contracts/build/HTTP ผ่านไม่ได้แทนการตรวจสองบัญชีจริง
- ยังไม่มี Web/LINE push ขณะปิดเว็บ, Advanced strategy, TFEX signal lifecycle, complete holiday/corporate-action calendar หรือการรองรับ fixed/minimum/FX costs

หลักฐานอยู่ใน outputs ของแชท: `signal-desk-tests-2026-10-15.log`, `signal-desk-http-2026-10-15.json`, `signal-desk-build-2026-10-15.log`, `signal-desk-cloud-build-2026-10-15.log`, `signal-desk-scanner-build-2026-10-15.log`, `signal-desk-data-2026-10-15.log`, `signal-desk-live-proof-2026-10-15.json`, `signal-worker-2026-10-15.log`

## Runtime และการนำขึ้นระบบจริง

```sh
npm run autopick:worker    # Swing worker เป็นค่าเริ่มต้นแล้ว
npm run signals:worker    # ชื่อโดยตรงของ worker เดียวกัน
npm run probe:signals     # อ่านราคาจริง/replay ตัวอย่าง ไม่มีการเขียนข้อมูลสมาชิก
npm run test:signals
npm run check:prelaunch
```

SQLite เพิ่ม schema version 10 แบบ additive; D1 มี `0010_signal_desk.sql` และ migration/import tooling รวมตารางใหม่แล้ว ต้อง apply migration 0010 บนเป้าหมายก่อน deploy web/scanner รุ่นนี้ แยก lease/event storage และสิทธิข้อมูลให้ครบ Cloud consumer ใช้ Queue jobs ของ Swing ที่เก็บถาวร พร้อม retry/coalescing ไม่เรียก ORB ใหม่

เครื่องนี้เปิด Swing worker แล้วและเปลี่ยน LaunchAgent `com.nugaom.autopick` ให้เรียก `scripts/signal-worker.mjs` พร้อม bootout/bootstrap สำเร็จ จึงไม่ถูก supervisor เปิด ORB เดิมกลับมาซ้อนกัน ปิด manual process ที่ใช้ตรวจชั่วคราวแล้ว และปรับ systemd template ให้เรียก Swing เช่นกัน โค้ดรองรับ graceful drain เมื่อรับ SIGTERM/SIGINT ไม่เปลี่ยน launch/display-rights flags, credentials หรือ customer holdings การทำงานต่อเนื่องยังต้องมี process และเครื่องที่ไม่พัก; Cloud Worker ยัง `SCANNER_ENABLED=false` ตามเดิม ต้องเตรียม hosting/storage/สิทธิข้อมูล/HTTPS และทดสอบสอง LINE accounts ตาม [prelaunch acceptance](prelaunch-acceptance-2026-10-15.md) ก่อนเปิดลูกค้าสาธารณะ
