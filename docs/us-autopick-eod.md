# US AutoPick · EOD pilot

> Current update 3 October 2026: the scanner now uses 500 data-verified liquid stocks with FMP / Yahoo closed daily candles. See [current universe and verification](./us-liquid-universe.md). The Nasdaq-100 coverage and provider setup below document the previous rollout.

> อัปเดต 29 ก.ย. 2026: กติกาใหม่ `us-eod-breakout-v0.2-unvalidated` อยู่ใน [กติกาสแกนตามข้อมูลที่ระบบมี](scanner-rules-2026-09-29.md). แผน v0.1 ที่บันทึกไว้ยังถูกติดตามตามข้อมูลในแผนนั้นจนจบสถานะ รายละเอียดกติกาด้านล่างเป็นประวัติของ v0.1

> อัปเดต 30 ก.ย. 2026: หากข้อมูล EOD ของวันก่อนมาช้า worker จะลองต่อได้ถึง 08:00 น. ตามเวลานิวยอร์กในเช้าถัดไป และบันทึกแผนด้วยวันที่แท่งปิดเดิม. ก่อนหน้านี้การลองหยุดที่ 22:00 น. อาจพลาดวันที่ข้อมูลมาหลังเวลานั้น. การขยายเวลานี้ยังต้องตรวจ quota และผลรอบจริง

## ข้อมูลที่ใช้

- Scanner ใช้แท่งราคาหุ้นรายวัน OHLCV จาก `Financial Modeling Prep · EOD` ผ่าน server-only `FMP_API_KEY`.
- รายชื่อ 101 securities ใช้ Nasdaq snapshot 1 พ.ค. 2026 ปรับด้วยการเปลี่ยนสมาชิกที่ Nasdaq ประกาศให้มีผล 22 มิ.ย. 2026. รายชื่อนี้ต้องทบทวนก่อน reconstitution รอบถัดไป และการมีรายชื่อใน snapshot ไม่ได้ยืนยันสิทธิใช้หรือเผยแพร่ดัชนี.
- Worker รอให้แท่งวันปัจจุบันปรากฏหลังตลาดนิวยอร์กปิดอย่างน้อย 30 นาที (เวลา New York และ DST มาจาก `America/New_York`). ตัว adapter จะตัดแท่งของวันปัจจุบันออกก่อน 16:30 น. นิวยอร์ก แม้ API จะส่งแถวราคาของวันนี้ระหว่างตลาดเปิด. ถ้าแท่งปิดยังไม่มา จะรอรอบถัดไปและไม่ใช้แท่งเก่าเปิดแผนใหม่.
- ระบบนี้ไม่ใช่ intraday: PICK_READY, ENTRY, TARGET และ STOP อาจปรากฏหลังตลาดปิดเมื่อ worker ได้ข้อมูล EOD. Browser toast/เสียงทำงานเมื่อหน้าเว็บเปิด; เหตุการณ์ยังอ่านย้อนหลังได้เมื่อกลับมา.

## กติกานำร่อง

กติกา `us-eod-breakout-v0.1-unvalidated` สร้างเฉพาะแผน LONG และต้องผ่านทุกข้อ:

- มีแท่งปิดแล้วอย่างน้อย 60 วันทำการ
- ราคาปิดเหนือ EMA20, EMA20 เหนือ EMA50 และ EMA20 สูงขึ้นจาก 5 แท่งก่อน
- RSI14 อยู่ช่วง 50–70
- มูลค่าซื้อขายเฉลี่ย 20 วันอย่างน้อย 10 ล้านดอลลาร์
- คะแนนหลักฐานอย่างน้อย 70/100
- จุดเข้าอยู่เหนือ High ของแท่งล่าสุด 0.10 ATR; stop อยู่ใต้ low ต่ำสุด 10 วันก่อน 0.10 ATR
- ความเสี่ยงอยู่ในช่วง 0.60–2.20 ATR; TP1 ใช้แนวต้านย้อนหลังที่อยู่เหนือจุดเข้า หรือเป้าคำนวณ 2R และต้องให้ R:R อย่างน้อย 1.80
- Entry จะยืนยันเมื่อแท่ง D1 ถัดไปปิดเหนือ trigger โดยไม่ไล่ราคาที่ปิดห่างเกินกรอบ; การทะลุระหว่างวันแล้วปิดกลับลงมาไม่ถือว่าเข้า

สูตรนี้เป็นกติกาเชิงเทคนิคที่ยังไม่ได้ backtest และไม่ได้ผ่านการปรับให้เหมาะกับหุ้นแต่ละตัว. คะแนนไม่ใช่ความน่าจะเป็นหรือ win rate. ควรใช้เป็น pilot และเก็บผลจริงก่อนพิจารณาปรับ threshold.

## การติดตามผล

- หลังเข้าแล้วใช้แท่ง D1 ถัดไปตรวจ High/Low เทียบ TP1/SL.
- ถ้าแท่งเดียวแตะ TP1 และ SL ให้สถานะ `AMBIGUOUS`; ถ้าข้อมูลขาดช่วงเกิน 6 วันปฏิทินหรือถือครบ 20 แท่งแล้วยังไม่ถึงระดับ ให้ `REVIEW`.
- ราคา event เป็นระดับที่อนุมานจาก OHLC และไม่ใช่ broker fill; ยังไม่รวม commission, market impact, slippage, dividend/corporate-action treatment, borrow cost หรือ tax.
- Watchlist มีเฉพาะ common stocks ตาม Nasdaq-100 snapshot; ไม่เปิด short, options หรือ extended-hours.

## เปิดใช้งาน

ใน `.env.local` ตั้ง `AUTO_PICK_US_ENABLED=true`, `FMP_API_KEY`, `AUTO_PICK_RUN_SECRET` (สุ่มอย่างน้อย 32 ตัวอักษร), `DATABASE_PATH` บน storage ถาวร และ `AUTO_PICK_PERSISTENT_SERVER_CONFIRMED=true` เมื่อยืนยัน host/backup แล้ว. ใน production ตั้ง `FMP_DISPLAY_RIGHTS_CONFIRMED=true` ได้เมื่อผู้ให้บริการยืนยันสิทธิแสดง/จัดเก็บข้อมูลสำหรับลูกค้าแล้วเท่านั้น. ใช้ `npm run autopick:worker` ให้ทำงานต่อเนื่องหลังตลาดปิด.

Worker ใช้ historical full EOD endpoint แยกทีละ ticker (จำกัด concurrency 4); เปิดใช้งานจึงต้องมี request quota เหลือพอสำหรับ 101 รายชื่อในวันสแกน. FMP bulk EOD และ Nasdaq-100 membership endpoint ถูกตรวจด้วย API key ปัจจุบันแล้วตอบ HTTP 402 จึงไม่ใช้ลดจำนวน request หรือดึง universe อัตโนมัติ.

## แหล่งอ้างอิง

- [Nasdaq NDX snapshot, data as of 1 May 2026](https://www.nasdaq.com/docs/2026/05/04/NDX.pdf)
- [Nasdaq June 2026 quarterly changes](https://ir.nasdaq.com/news-releases/news-release-details/nasdaq-100-indexr-june-2026-quarterly-changes)
- [FMP historical EOD API](https://site.financialmodelingprep.com/developer/docs/stable/historical-price-eod-full)
- [FMP EOD Bulk API](https://site.financialmodelingprep.com/developer/docs/stable/eod-bulk)
