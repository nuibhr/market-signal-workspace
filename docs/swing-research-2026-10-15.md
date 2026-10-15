# ข้อมูลสำรองและ Swing backtest — 15 ตุลาคม 2026

เพิ่มข้อมูลกราฟสำรองแบบดีเลย์, ชุด CSV จริง และตัวจำลอง Standard สำหรับงานวิจัยแล้ว **ยังไม่มีผล backtest ครบ 3 ปีที่รับรองได้ และยังไม่ได้เปลี่ยน AutoPick เดิมให้ใช้โมเดล Swing ใหม่**

เอกสารนี้ต่อจาก [ผลทดสอบก่อนเปิดใช้งาน](prelaunch-acceptance-2026-10-15.md) ฐาน `b910699` เกณฑ์เปิดใช้จริงในรายงานเดิมยังต้องดำเนินการต่อ ไม่มีการ deploy หรือเปลี่ยน maintenance/launch flags ในรอบนี้

## สิ่งที่พร้อมใช้และสิ่งที่ยังขาด

| ส่วน | ทำได้แล้ว | ยังไม่พร้อม |
| --- | --- | --- |
| กราฟหุ้นไทย/DR | เมื่อคำขอหลักล้มเหลว/หมดเวลา/ข้อมูลเก่า ใช้ snapshot ของ symbol/frame เดิม แล้วลอง Yahoo ถ้าจำเป็น | ต้องยืนยันสิทธิแสดงข้อมูลแต่ละ provider ก่อน production; ไม่รับรอง Yahoo ว่ามีทุก symbol |
| กราฟ US/ETF | D1 ใช้แหล่งหลักและ snapshot/Yahoo สำรอง; intraday ใช้ Yahoo ของ ticker/ประเภทสินทรัพย์จริง | ไม่มี native 4H ที่ตรวจสอบแล้ว; ไม่แปลงชื่อ 1H เป็น 4H |
| กราฟ TFEX | เก็บ snapshot สัญญาเดิมข้าม request ได้ทั้ง SQLite และ D1 | ไม่มี Yahoo mapping ที่ยืนยันว่าเป็น TFEX สัญญาเดียวกัน จึงไม่เอา index/ทอง spot/ฟิวเจอร์สต่างประเทศมาแทน; ไม่มี snapshot จะยัง unavailable |
| แผน Swing Standard | Stop ใต้ confirmed swing low − ATR14, ข้ามเมื่อกว้างเกิน 8%, TP1 อย่างน้อย 2R สุทธิ, cost-covered breakeven, ขายครึ่ง/runner trail | เป็น research candidate เสมอ `liveEligible:false`; ไม่แก้ signal ที่มีอยู่ย้อนหลัง |
| ตัวจำลอง Standard | breakout/pullback แยกผล, risk 0.5%/1%, D1 trend กับ 4H structure, delayed entry, gaps, partial exits, trailing, expectancy/PF/close-based MDD | CLI เท่านั้น; ข้อมูลจริงยังไม่ผ่าน coverage จึงคืน `metrics:null`; ไม่มีหน้าผล Swing สำหรับลูกค้า |
| Advanced | บันทึก stop 1/1.5 ATR, 1R/2R/runner และ EMA20/Chandelier เป็นข้อกำหนดและคำนวณแผนได้ | ยังไม่มี historical replay ของ Advanced, weekly/market/earnings filters หรือ underlying/FX mapping ของ DR |
| TFEX backtest | บันทึกค่าคอม S50/GO/MGO ต่อสัญญาต่อข้างและ VAT แยก | ยังไม่มี Long/Short replay, margin, contract rollover/expiry, exchange fees และ execution slippage model ที่ครบ |
| ต้นทุน US/ETF | manifest ต้องใส่ต้นทุนเอง ไม่มีการนำ 0.06% หรือศูนย์ไปใช้แทนช่องว่าง | ยังไม่มีหน้าจอให้ลูกค้าปรับค่าคอม/ขั้นต่ำ/FX; ตัวจำลองปัจจุบันรองรับเปอร์เซ็นต์ต่อข้าง ไม่รองรับ fixed/minimum/FX cash flows |

## กติกาข้อมูลสำรอง

- เก็บเฉพาะแท่งสาธารณะใน `provider_cache` เดิม ไม่เก็บ quote/session/ข้อมูลสมาชิก; upsert ป้องกันคำตอบเก่าทับ snapshot ใหม่, TTL 7 วัน
- แสดงเฉพาะแท่งที่ขอบเขตปิดเก่าอย่างน้อย 15 นาที ระบุแหล่งข้อมูล, เวลาแท่ง, อายุจากขอบเขตแท่ง และสถานะ delayed/stale จริง ไม่อ้างว่า feed มี SLA 15 นาทีพอดี
- D1 ใช้ขอบเขตปิดแบบระมัดระวัง: ไทย 17:00 Bangkok; US 16:00 New York พร้อม DST ยังไม่มี early-close calendar จึงอาจรอนานกว่าตลาดปิดจริง
- fallback ทุกชุดเป็น `chartOnly:true`, `signalEligible:false`, `executionEligible:false`, `quote:null` จึงไม่ให้ข้อมูลที่ดีเลย์มายืนยัน AutoPick/การเข้าราคาย้อนหลัง
- กรอง Yahoo live observation ที่มีวินาทีไม่ตรงแท่ง, 15m ไม่ตรงช่วง 15 นาที และ US intraday นอกช่วงเริ่มแท่งตลาดปกติ รวม closing quote 16:00 ที่ Yahoo แทรกไว้
- ฝั่งเว็บมี timeout รวมการอ่าน JSON และยกเลิกคำขอเมื่อเปลี่ยน selection ข้อมูล backup ที่เก่ากว่าไม่ทับแท่งหลักที่ใหม่กว่า

[SET มีบริการข้อมูล delayed 15 นาทีสำหรับ equity/TFEX](https://www.set.or.th/en/services/connectivity-and-data/data/realtime) แต่ต้องมีสิทธิข้อมูลและแหล่งที่ตรงสินทรัพย์ การเพิ่ม minimum lag ไม่ได้สร้าง entitlement หรือรับรอง latency ของ Yahoo

## ต้นทุนล่าสุดที่ผู้ใช้ยืนยัน

ค่าทั้งหมดต่อข้างและยังไม่รวม VAT เว้นแต่ระบุในคอลัมน์ผลคำนวณ ข้อมูล 0.06% แทนค่าคอม 0.157% เดิม เฉพาะหุ้นไทย/DR

| ตลาด/กรณี | ค่าคอม | สมมติฐานเพิ่มเติม | ผลประมาณ |
| --- | --- | --- | --- |
| หุ้นไทยใหญ่ | 0.06% ต่อข้าง | market fee 0.005%, VAT 7% บนคอม, slippage 0.15% ต่อข้าง | roundtrip 0.4384% |
| หุ้นไทยเล็ก | 0.06% ต่อข้าง | market fee/VAT เดิม, slippage 0.4% ต่อข้าง | roundtrip 0.9384% |
| DR lower/stress | 0.06% ต่อข้าง | สมมติ market fee/VAT เช่นไทย (ต้องยืนยันขอบเขต fee), slippage 0.3% / 0.5% ต่อข้าง | roundtrip 0.7384% / 1.1384% ก่อน FX |
| S50 | 16 บาท/สัญญา/ข้าง | VAT 7% | คอม+VAT 17.12 บาท/ข้าง, 34.24 บาทไปกลับ |
| Gold Online | 50 บาท/สัญญา/ข้าง | VAT 7% | คอม+VAT 53.50 บาท/ข้าง, 107 บาทไปกลับ |
| MGO | 5 บาท/สัญญา/ข้าง | VAT 7% | คอม+VAT 5.35 บาท/ข้าง, 10.70 บาทไปกลับ |
| US/ETF | ผู้ใช้กำหนด | ต้องระบุ commission, market fee, VAT, slippage เอง; ตัวเลขศูนย์ต้องกรอกชัดเจน | ไม่ใช้ค่า default ไทย |

roundtrip เป็นประมาณที่ notional เดิม สูตร TP/BE คิดค่าซื้อและขายตามราคาของแต่ละข้างจริง ค่าคอม+VAT ของ TFEX ไม่ใช่ต้นทุนรวม ต้องทราบว่า broker รวม exchange/licensing แล้วหรือยัง และต้องนับ spread/slippage/rollover แยก การ gap อาจเสียมากกว่า Stop ที่ตั้งไว้ ไม่ใช้การเพิ่มค่าธรรมเนียมเปอร์เซ็นต์มาแทน gap

## CSV ที่สร้างจริง

ส่งออกวันที่ 15 ต.ค. 2026 ได้ **21 price CSV จาก 7 สินทรัพย์ รวม 19,012 แท่งหลังตรวจ** และ inventory CSV 1 ไฟล์ พร้อม manifests, provenance, SHA-256, readiness และรายการ observation ที่ตัดออก 14 รายการ ไม่สร้างแท่งเติมช่วงว่าง

| สินทรัพย์ | D1 | Intraday | ช่องว่างสำคัญ |
| --- | --- | --- | --- |
| SCB / PTT | ตัวละ 727 แท่ง, 2023-10-16 ถึง 2026-10-14 | ตัวละ 483 × 4H และ 377 × 15m | D1 ไม่มี 200 แท่ง warmup ก่อนเริ่ม; 4H ประมาณปีเดียว; 15m ช่วงสั้น |
| AAPL80 | 622 แท่ง, เริ่ม 2024-03-18 | 999 × 4H และ 774 × 15m | ประวัติ DR เริ่มหลังช่วงที่ขอ; intraday ไม่ครบ 3 ปี |
| S50Z26 | 192 แท่ง, เริ่ม 2025-12-29 | 385 × 4H และ 393 × 15m | เป็นสัญญาเฉพาะ ไม่ใช่ continuous series 3 ปี |
| GOZ26 | 74 แท่ง, เริ่ม 2026-06-29 | 374 × 4H และ 998 × 15m | เป็นสัญญาเฉพาะ; quote USD และ settle THB |
| NVDA | 1,098 แท่ง, 2022-05-31 ถึง 2026-10-14 | 3,324 × 1H และ 1,092 × 15m | D1 มี warmup แต่ไม่มี 4H และ 15m ไม่ครบ 3 ปี |
| SPY | 1,098 แท่ง, ช่วงเดียวกับ NVDA | 3,323 × 1H และ 1,092 × 15m | ช่องว่างเช่นเดียวกับ NVDA |

GO 15m เคย unavailable ระหว่าง export ครั้งแรก อ่านใหม่สำเร็จแล้ว และตรวจ hash/จำนวนแถวหลังแก้ inventory อีกครั้ง Source native คือ Settrade/TFEX; US ใช้ Yahoo ไม่รวมราคา FMP/Yahoo ที่ปรับ corporate actions คนละแบบใน CSV เดียว

ไม่มีราคา MGO ในชุดนี้ เนื่องจากยังไม่มี mapping สัญญาที่ตรวจแล้วใน app catalog และ [TFEX เปิด MGO วันที่ 25 พ.ค. 2026](https://www.tfex.co.th/en/market-data/news-and-notice/trading-notice/newsdetails?id=104808300&symbol=TFEX) จึงไม่มีประวัติ MGO จริงย้อนไปถึงปี 2023 ห้ามเอา GO มาสวมชื่อ MGO; [GO/MGO มี multiplier ต่างกัน](https://www.tfex.co.th/en/products/precious-metal/gold-online-futures/contract-specification)

## วิธีใช้ตัวตรวจและตัวจำลอง

```sh
npm run export:swing-csv -- /absolute/new-empty-directory
npm run check:swing-data -- /absolute/dataset/manifest.json
npm run backtest:swing -- /absolute/dataset/manifest.json
npm run test:swing
```

export ไม่เขียนทับโฟลเดอร์เดิม ไม่มีการส่งคำสั่งซื้อขายหรือแก้ฐานสมาชิก ตัวตรวจรับ CSV จาก TradingView/broker (`time,open,high,low,close,volume`) ที่มี timezone/epoch ชัดเจน; date-only สำหรับ D1 ใช้วันซื้อขายตามไฟล์ timestamp D1 แปลงตาม timezone ของ manifest รองรับตรวจ 1H โดยไม่สวมเป็น 4H, แต่ไฟล์ที่ใช้ replay ต้องเป็น D1/4H/15m รับ Parquet หลังแปลง CSV เท่านั้น

manifest ต้องมีตัวตนสินทรัพย์/สกุลเงิน/timezone/provider, ช่วงเวลา, split adjustment, trading calendar พร้อมจำนวนและ timestamp เริ่มแท่ง 4H/15m ต่อวัน, D1 warmup 200 แท่ง และ 4H warmup 50 แท่ง ตัวตรวจไม่ใช้เพียงวันแรก/วันสุดท้ายหรือจำนวนรวมแทน coverage และไม่ยอมอ่าน symlink/ไฟล์ออกนอกโฟลเดอร์ dataset

ก่อน replay ต้องตั้ง `entryRules`, `initialCapital`, `lotSize` เป็นจำนวนคู่เพื่อขายครึ่งได้จริง, `tickSize` และ `constantTickConfirmed:true` ให้ตรง instrument ปัจจุบันยังไม่รองรับตาราง tick เปลี่ยนขั้นตามราคา จึงห้ามยืนยัน constant tick หากราคาในช่วงนั้นข้ามขั้น tick

ค่าตัวอย่าง `RESEARCH_ENTRY_RULES` ใน source เป็นสมมติฐานวิจัยที่เปิดเผยให้เทียบ:

```json
{
  "dailyFastEMA": 20,
  "dailySlowEMA": 50,
  "breakoutLookback": 20,
  "pullbackEMA": 20,
  "pivotWidth": 2,
  "maximumEntryWaitHours": 24
}
```

D1 ปิดเหนือ EMA20 และ EMA20 เหนือ EMA50; breakout ปิดเหนือ high ของ 20 แท่ง 4H ก่อนหน้า; pullback แตะ EMA20 แล้วปิดขึ้นเหนือ EMA และ high แท่งก่อนหน้า พร้อมแท่งบวก เป็นกติกาที่ implement เพื่อวิจัย ยังไม่ใช่นิยาม entry ที่ผู้ใช้ยืนยันทุกพารามิเตอร์

Swing low ต้องมีแท่งด้านขวายืนยันครบ 2 แท่งโดยไม่เห็นข้อมูลอนาคต ATR ใช้ Wilder 14 ของ 4H จุดเข้าคือ open ของ execution 15m แรกหลังแท่ง signal ปิด+15 นาที ไม่ใช่ราคาปิดเก่า เป้าคำนวณใหม่จากราคาที่เข้าจริงและตรวจแนวต้านก่อน 2R ไม่เลื่อน Stop เข้าหา entry เพื่อแต่ง R:R

ขายครึ่งที่ 2R แล้วอีกครึ่งที่ BE ได้ประมาณ 1R ต่อทั้งไม้ ไม่รายงานเป็น 2 เทรดชนะหรือเฉลี่ย 2R Stop ที่ gap ใช้ open ที่เสียเปรียบ TP limit ใช้ราคาที่ตั้งไว้ ถ้าแท่งเดียวแตะ Stop/TP โดยไม่รู้ลำดับให้ใช้กรณีเสียเปรียบและติด `ambiguous`; กรณี open ข้าม TP จะทราบว่า TP เกิดก่อน low ภายในแท่ง จัดลำดับตามนั้น เวลา exit ใน output คือหน้าต่าง 15m ไม่ใช่ timestamp fill จริง

รายงาน expectancy/PF คิดเฉพาะไม้ที่ปิดครบ Runner ที่เปิดอยู่แสดงแยกพร้อม liquidation equity; MDD วัดที่ 15m close หลังต้นทุน ไม่ใช่ intrabar/tick MDD ไม่บังคับปิด runner เพื่อให้ตัวเลขชนะเพิ่ม ไม่มีการนับ dividends/FX cash flow, margin หรือ liquidity queue ใน engine นี้ แม้ data preflight ผ่านก็ยัง `strategyValidated:false`

เกณฑ์เป้าหมายของผู้ใช้คือ expectancy > 0, PF ≥ 1.5, mean closed net R ≥ 2 และ MDD ที่รับได้ ซึ่งยังไม่กำหนดเพดาน การได้ TP1 2R ไม่ยืนยันว่า mean net R จะถึง 2 ต้องทดสอบ runner และผลขาดทุนทั้งหมดจริง

## หลักฐานตรวจในรอบนี้

- รวม **200 tests ผ่าน, 0 fail/skip** ครอบคลุม snapshot SQLite/D1, identity/สิทธิ provider, Yahoo timestamps, timeout/abort, CSV/hash/path, structural stop, costs/net-R, gaps/partials/trail และ fixture replay ทั้งสอง mode/สอง risk; fixture เป็นข้อมูลทดสอบ ไม่อยู่ใน CSV ราคาให้ผู้ใช้
- Next build ผ่านด้วย `.next-review` และ Cloud build ผ่าน ไม่มี deploy
- Anonymous HTTP smoke ผ่าน **54/54**; ไม่สร้าง session, ไม่เขียนพอร์ต/สมาชิก, ไม่ยิง scan หรือเทรด
- การทดสอบ fallback ผ่าน **7/7**: client helper จำลอง primary HTTP 503 แล้วอ่าน backup API จริง 4 ตลาด และอ่าน Yahoo จริง PTT/AAPL80/SPY อีก 3 รายการ ไม่ปิดผู้ให้บริการจริง ดูผลใน `delayed-swing-fallback-2026-10-15.json`
- ตรวจ 21 CSV ด้วย parser และ SHA-256; readiness และ replay ของทั้ง 7 สินทรัพย์ยัง blocked ตามข้อมูลที่ขาด ไม่มี performance metric ถูกสร้างแทนข้อมูลว่าง
- `git diff --check` ผ่าน ข้อจำกัด browser localhost จากรอบก่อนยังคงอยู่ จึงไม่มีการอ้างว่าทดสอบ visual/WebGL/mobile/เสียงผ่านในงานนี้

## งานถัดไปที่จำเป็น

1. เติม D1/4H/15m ของช่วง 2023-10-15 ถึงก่อน 2026-10-15 พร้อม warmup, สิทธิใช้ข้อมูล, session timestamps, split/dividend และ provenance จริง เมื่อ TradingView MCP อนุมัติ ต้องตรวจว่า connector ให้ OHLCV/frame/ช่วงย้อนหลังได้จริง [Charting Library เองไม่ได้ให้ market data](https://tradingview.com/charting-library-docs/latest/connecting_data/)
2. ปิดการรองรับ tick ขั้นราคา, FX/fixed/minimum fees และ corporate action cash flows ก่อนขยายผล Standard เป็น customer backtest
3. ทำ Advanced replay พร้อม weekly/market/earnings filters และ TFEX Long/Short/rollover/margin/ค่าธรรมเนียมสัญญา จากนั้นเปรียบเทียบโปรไฟล์โดยไม่ปรับกฎเข้าหาผลย้อนหลังอย่างเดียว
4. เพิ่มหน้าตั้งค่าต้นทุน US/ETF และหน้าผล Swing พร้อม trade ledger, equity/MDD, coverage และข้อสมมติฐาน ปัจจุบันหน้า performance เดิมเป็น recorded-signal ledger ไม่ใช่ backtest Swing 3 ปี
5. หลังผลวิจัยและ out-of-sample ผ่าน จึงเปลี่ยนเส้นทาง live plan/lifecycle และทดสอบบน runtime ต่อเนื่องตาม prelaunch checklist เดิม Thai/DR ORB ปัจจุบันยังใช้ risk budget ย้อนจาก target/4% ceiling จึง **ยังไม่ได้แก้ปัญหา Stop แคบใน live model ทั้งระบบ**
