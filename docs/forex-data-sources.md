# ราคา Forex จริง: แหล่งข้อมูลและขอบเขตที่ต่อแล้ว

อัปเดต 26 ก.ย. 2026

## สิ่งที่ใช้งานในพื้นที่พัฒนา

- เมื่อเลือกคู่เงินหรือโลหะสปอต แอปเรียก `GET /api/quote?symbol=EUR%2FUSD` ฝั่งเซิร์ฟเวอร์ และขอ [FMP Forex Quote](https://site.financialmodelingprep.com/developer/docs/stable/forex-quote) ด้วย `FMP_API_KEY` ที่เก็บใน `.env.local` เท่านั้น
- แสดงราคา snapshot, การเปลี่ยนแปลง, high/low, เวลาแหล่งข้อมูล และสถานะข้อมูลล่าสุด/ล่าช้าหรือตลาดปิด มี cache 60 วินาทีต่อตัวที่เลือก ไม่มีการจำลองราคาเมื่อแหล่งข้อมูลตอบไม่ได้
- หุ้นสหรัฐฯ และ ETF ในหมวดใหม่ใช้ quote endpoint เดียวกัน การขอข้อมูลแบบ batch ด้วยแผน API ที่มีอยู่ได้รับ 402 จึงดึงเฉพาะตัวที่ผู้ใช้เลือก เพื่อลดการใช้โควตา หุ้นสหรัฐฯ ที่เลือกยังมีกราฟ 1D จาก FMP EOD แยกอีก endpoint; Forex interval ตอบ 402 กับแผนปัจจุบัน
- Quote ยังไม่ใช่แท่ง OHLCV; กราฟ Forex หลายกรอบเวลาและสัญญาณเทคนิคจะไม่ใช้ข้อมูล snapshot มาแทนแท่งราคา

## ตัวเลือกสำหรับขั้นถัดไป

| แหล่ง | เหมาะกับ | สิ่งที่ต้องตรวจสอบ |
| --- | --- | --- |
| [FMP Forex Quote](https://site.financialmodelingprep.com/developer/docs/stable/forex-quote) | ราคา snapshot ที่ต่อแล้ว | สิทธิแสดงผลในผลิตภัณฑ์และแผน API; [แผน Commercial](https://site.financialmodelingprep.com/developer/docs/pricing?planType=commercial) แยกจากการใช้ส่วนตัว |
| [FMP Forex Interval](https://site.financialmodelingprep.com/developer/docs/stable/forex-intraday-5-min) | หากต้องการแท่งราคาในผู้ให้บริการเดียวกัน | แผนที่เข้าถึง interval endpoint, ความถี่, timezone และสิทธิแสดงกราฟ |
| [Twelve Data Business](https://twelvedata.com/pricing-business) | ราคา/แท่งหลายตลาดเพื่อใช้ในผลิตภัณฑ์ | โควตา แผนธุรกิจ สิทธิแสดงต่อผู้ใช้ และเวลาหน่วง |
| [OANDA v20 Pricing](https://developer.oanda.com/rest-live-v20/pricing-ep/) | ราคา bid/ask ของบัญชีโบรกเกอร์ | ต้องมีบัญชี/โทเคนและตรวจเงื่อนไขการนำราคาไปแสดงแก่ลูกค้ารายอื่น |

ลำดับที่แนะนำ: คง FMP เป็นราคา snapshot สำหรับหน้ารายการก่อน แล้วเลือกแหล่งแท่งราคา OHLCV ที่อนุญาตการแสดงผลจริงก่อนเปิดกราฟและสแกน Forex เต็มรูปแบบ เทียบ symbol mapping, timezone, ความถี่อัปเดต, bid/ask และค่าใช้จ่ายกับกลุ่มผู้ใช้ที่จะให้บริการ

[Yahoo OAuth 2.0 guide](https://developer.yahoo.com/oauth2/guide/) ที่ส่งมาเป็นคู่มือยืนยันตัวตนสำหรับ Oath Ad Platforms และ UserInfo APIs ตามเอกสาร ไม่ได้ให้สิทธิหรือ endpoint ราคาคู่เงินสำหรับใช้เป็นฟีดสำรอง การเรียก Yahoo Finance ผ่านช่องทางที่ไม่มีข้อตกลงข้อมูลจึงไม่ถูกเปิดเป็น fallback ในระบบนี้ ส่วนปลั๊กอิน/MCP ใน Codex มีประโยชน์กับการวิจัย แต่ไม่ใช่ฟีดราคาเบื้องหลังเว็บไซต์ที่ผู้ใช้ปลายทางเรียกได้โดยตรง

การแสดงราคาสาธารณะใน production ถูกปิดไว้ด้วย `FMP_DISPLAY_RIGHTS_CONFIRMED=false` จนกว่าจะยืนยันสิทธิในข้อตกลงของผู้ให้บริการ
