# แผนข้อมูลตลาดไทยและ Investing.com Webmaster Tools

ตรวจเมื่อ 25 กันยายน 2026 จากโค้ดใน `nuibhr/noom-nakaom-scanner` และเอกสารทางการของผู้ให้ข้อมูล การมีตัวแปรลับใน Vercel ยืนยันเพียงว่าตั้งค่าไว้ ยังไม่ยืนยันว่า API ตอบสำเร็จหรือมีสิทธิ์แสดงข้อมูลต่อผู้ใช้แอป

## ข้อมูลไทยที่นำมาใช้ได้ตามโค้ดเดิม

| กลุ่ม | ดึงได้จากโค้ดที่มี | สิ่งที่ต้องตรวจเพิ่ม |
|---|---|---|
| หุ้น SET / mai | Settrade quote: last, change, %change, high, low, volume; แท่งรายวัน OHLCV สูงสุด 100 แท่งต่อคำขอ โค้ดสแกน SET100 และรายชื่อ mai ชุดหนึ่ง | สิทธิ์ของบัญชีจริง, รายชื่อหุ้นทั้งตลาด, เวลา quote จากต้นทาง, ความยาวย้อนหลังสูงสุดและแท่งระหว่างวัน |
| DR | Settrade quote และแท่งรายวัน OHLCV สำหรับ DR ที่อยู่ในรายการเดิม | รายชื่อ DR ทั้งหมด, underlying, FX, conversion ratio, ข้อมูล corporate action |
| TFEX: Gold / Silver / SET50 | TFEX Open API quote ต่อสัญญา: last, change, open, high, low, volume, open interest, market status; helper เลือกสัญญาปัจจุบัน | แต่ละตระกูลสัญญาที่เปิดสิทธิ์, ชื่อและวันหมดอายุที่ถูกต้อง, bid/offer, OHLCV ย้อนหลัง, ข้อมูลระหว่างวัน |
| ดัชนี SET และ breadth | ยังไม่มี feed ที่ยืนยันได้ในโค้ดเดิม | API สิทธิ์ตรงจาก SET หรือช่องทาง broker; breadth ปัจจุบันคืน `unavailable` |

คำว่า “live” ในบางส่วนของแอปเก่าหมายถึงคำขอสำเร็จ ไม่ได้พิสูจน์ว่า exchange ส่งข้อมูลตามเวลาจริง ตัวแปลงแท่งรายวันเก่าแทน timestamp ที่ผิดรูปแบบด้วยเวลา `now`; ต้องแก้ให้ปฏิเสธแท่งนั้น เพราะ timestamp ที่แต่งขึ้นทำให้กราฟและการตัดสินผลสัญญาณผิดได้ Quote บางตัวติดเวลา fetch แทนเวลา exchange ต้องแสดง `receivedAt` แยกจาก `observedAt` และใช้คำว่า latency ไม่ทราบถ้าไม่มีเวลาจากต้นทาง

**ผลตรวจแบบ read-only จากเครื่องนี้:** ลอง login Settrade ด้วยค่าทั่วไปในไฟล์ท้องถิ่น `tfex.txt` โดยใช้เส้นทาง login ตามโค้ดเดิม ได้ HTTP 404 จึงยังไม่ถึงขั้นดึง quote/แท่งของ PTT หรือ AAPL80 ผลนี้ไม่ได้ยืนยันว่าคีย์ใน Vercel ใช้ไม่ได้ เพราะอาจเป็นคนละชุดค่าหรือบริบทของ broker; ต้องตรวจการตั้งค่าและสิทธิ์กับผู้ให้บริการโดยไม่แสดงค่าคีย์ การทดลองไม่ได้เรียกบัญชีหรือส่งคำสั่งซื้อขาย

**สิ่งที่เห็นบน Production UI วันที่ 25 กันยายน:** หน้า SET/mai แสดง AI Picks โดยระบุ Settrade Market API; หน้า DR ระบุว่า DR Tracker ขาด credential; หน้า TFEX แสดงราคาสัญญาปัจจุบันเป็น unavailable ทั้ง S50, GO, MGO และ Silver รายการ mai ตัวหนึ่งยังถูกนำเสนอเป็น AI Pick ทั้งที่ราคาปิดล่าสุดลงวันที่ 3 กรกฎาคม (84 วันก่อนวันตรวจ) จึงต้องแยก “ได้รับข้อมูล” จาก “ข้อมูลใหม่พอสำหรับสัญญาณ” และห้ามเรียก quote ว่า real-time หากไม่มี timestamp ของต้นทาง การเห็นข้อมูลบนหน้าเว็บไม่ได้พิสูจน์สิทธิ์เผยแพร่หรือ latency ของ API

หน้าหุ้นไทยเดิมเรียกรายการ mai ว่า `MAI100` แต่ `shared/stockUniverse.ts` ระบุ allowlist จริง 50 สัญลักษณ์ ในแอปใหม่ให้แสดงจำนวน universe ที่สแกนจริงและจำนวนที่มีข้อมูลใช้ได้ แทนชื่อที่ทำให้เข้าใจว่าสแกนครบ 100 สัญลักษณ์

## แหล่งข้อมูลที่จะประกอบกัน

1. **Settrade/TFEX ที่มีอยู่:** เป็นเส้นหลักสำหรับราคาตราสารไทยที่ระบุสัญญาได้ตรงตัว ตรวจแบบ read-only รายตลาดและรายสัญญา; เก็บสถานะ configured → authenticated → quote available → daily bars available → intraday available แยกกัน
2. **Yahoo Finance:** เจ้าของอนุญาตให้พิจารณาเป็นตัวเสริมแล้ว โค้ดเดิมเรียก `query1.finance.yahoo.com/v8/finance/chart/` และใช้ `.BK` กับหุ้นไทย แต่ endpoint นี้ไม่ได้เป็นหลักฐานสิทธิ์นำราคาไปทำ feed ของแอป [Terms of Service ของ Yahoo ฉบับภูมิภาคหนึ่ง](https://legal.yahoo.com/in/en/yahoo/terms/otos/index.html) ระบุข้อจำกัดเรื่องการเก็บข้อมูลด้วยวิธีอัตโนมัติและการสร้างบริการข้อมูลทดแทน ต้องตรวจเงื่อนไขที่ใช้กับประเทศไทยและขอสิทธิ์ให้ตรงรูปแบบผลิตภัณฑ์ก่อนเปิด production หรือใช้ตัดสินแพ้ชนะโดยอัตโนมัติ หากใช้ได้ในภายหลัง ให้แสดงชื่อ Yahoo, delay และเวลาข้อมูลชัดเจน ห้ามต่อแท่งจากคนละต้นทางเป็น series เดียวโดยเงียบ ๆ
3. **SET SMART Marketplace:** เป็นทางตรงจากตลาดหลักทรัพย์ที่มี API สำหรับ historical intraday ของหุ้นและอนุพันธ์, EOD ของหุ้น/อนุพันธ์, ดัชนี, corporate actions และ fundamentals ตามผลิตภัณฑ์ที่สมัคร ไม่ใช่ API ฟรีที่เข้าได้ทันที [รายการบริการ](https://www.set.or.th/en/services/connectivity-and-data/data/smart-marketplace) และ [ตัวอย่างสเปก quote API](https://media.set.or.th/set/Documents/2023/May/Market_Data_API_Service_Specification.pdf) ระบุการใช้ API key หลังได้รับบัญชีจาก SET หน้า [ค่าบริการ snapshot หุ้น/ดัชนี](https://www.set.or.th/app/online-data/market-data?lang=en) แสดง real-time สำหรับบุคคล 15,000 บาท/เดือน และให้ติดต่อ SET สำหรับ delayed หรือการเผยแพร่ต่อ ราคา/สิทธิ์ผลิตภัณฑ์อื่นต้องขอใบเสนอราคาปัจจุบัน
4. **ข้อมูล TFEX ย้อนหลัง:** หาก broker ไม่เปิด candle endpoint ทางตรงคือผลิตภัณฑ์ historical/ EOD จาก SET ภายใต้สิทธิ์ที่ซื้อให้ตรงการใช้งาน [SET tick data](https://www.set.or.th/app/online-data/tick-data) ระบุการใช้ส่วนบุคคล/ภายในและให้ติดต่อเมื่อจะเผยแพร่ต่อ ห้ามใช้ spot gold, silver หรือดัชนี SET50 แทนแท่งสัญญา TFEX

การสลับแหล่งข้อมูลทำได้เฉพาะเมื่อ `venue + instrument ID + contract expiry + currency + timeframe + adjustment` ตรงกัน ระบบต้องแสดงสถานะขาดข้อมูลถ้าไม่ตรงกัน แต่ละสัญญาณเก็บ source และเวอร์ชันของข้อมูลที่ใช้สร้าง; การตัดสินผลใช้ series ที่ระบุไว้ล่วงหน้าและเก็บหลักฐานราคาแต่ละไม้ รวมทั้งไม้ที่แพ้ ไม่ชัดเจน หรือหมดอายุ

## Investing.com Webmaster Tools

คำว่า **“Add to your site”** ใน [หน้า Webmaster Tools](https://www.investing.com/webmaster-tools/) เป็นปุ่มไปตั้งค่า widget เพื่อสร้าง HTML สำหรับนำไปฝังในเว็บไซต์ จากขั้นตอนที่เผยแพร่บนหน้า [Economic Calendar](https://www.investing.com/webmaster-tools/economic-calendar) และ [Technical Charts](https://www.investing.com/webmaster-tools/technical-charts) ยังไม่พบขั้นตอนให้ลงทะเบียน domain ก่อน: เลือกค่าการแสดงผล → ยอมรับเงื่อนไข → กด Generate HTML Code → ฝังโค้ดในเว็บ นี่เป็น widget ใน iframe ไม่ใช่ API ที่ส่ง OHLCV หรือเหตุการณ์ดิบให้ backend ของเรา

| Widget | ความเหมาะสมกับ workspace |
|---|---|
| Economic Calendar | มีประโยชน์ในแถบเหตุการณ์เศรษฐกิจ เลือกประเทศไทยและประเทศอื่น, หมวดข่าว, ระดับความสำคัญ, timezone ได้ |
| Technical Summary / FX cross rates | ดูประกอบบริบทได้ แต่ไม่ใช้เป็นสัญญาณ AI หรือข้อมูลตัดสินผล; อย่าอ้างว่าเป็นราคา TFEX |
| Technical Charts | ซ้ำกับกราฟหลักที่เราจะสร้างด้วย TradingView Lightweight Charts และผูกกับข้อมูลที่ตรวจที่มาได้ จึงไม่จำเป็นในหน้ากราฟหลัก |

ข้อจำกัดสำคัญอยู่ใน [เงื่อนไข Investing.com หมวด Webmaster Tools](https://cdn.investing.com/about-us/terms_and_conditions.pdf): สิทธิ์ทั่วไปของ Tools สำหรับการใช้ส่วนตัวที่ไม่ใช่เชิงพาณิชย์; การใช้เชิงพาณิชย์ต้องได้อนุญาตเป็นลายลักษณ์อักษรผ่าน `tools@investing.com` เงื่อนไขยังห้ามแก้โค้ดฝังหรือซ่อนโฆษณา/ลิงก์ และกำหนดให้เว็บแจ้งเรื่องคุกกี้ ข้อมูลจาก Tools ไม่รับรองความแม่นยำหรือความทันเวลา และระบุว่าไม่มุ่งให้ใช้ซื้อขายจริง ดังนั้นยัง **ไม่ฝัง widget ในแอปที่จะให้ผู้ใช้อื่นใช้** หรือดึงข้อมูลใน iframe มาเก็บ/คำนวณ AI ก่อนสิทธิ์ชัดเจน การตกลงเงื่อนไขและขออนุญาตเป็นขั้นตอนของเจ้าของผลิตภัณฑ์

## งานถัดไปที่ลงมือทำได้

1. ย้าย adapter แบบ read-only ของ Settrade และ TFEX เข้าระบบ server ของ repo ใหม่ โดยไม่ย้ายไฟล์ key หรือข้อมูลบัญชี broker; เพิ่ม probe ที่รายงานเพียงความสำเร็จ/ล้มเหลวรายตลาด
2. ตรวจ quote และ daily bars ของหุ้นไทยหนึ่งตัว, DR หนึ่งตัว และ quote ของ Gold/Silver/SET50 ปัจจุบัน; บันทึก coverage กับ freshness โดยไม่พิมพ์ payload ที่อาจมีข้อมูลบัญชี
3. สร้าง instrument registry และ Lightweight Charts จากแท่งที่ผ่าน validation; หากไม่มีแท่ง TFEX ให้แสดง quote กับสถานะ “ยังไม่มีแท่งย้อนหลัง”
4. ขอรายละเอียดสิทธิ์ display/storage/redistribution จาก broker/SET สำหรับแอปที่มีผู้ใช้อื่น และจาก Investing.com หากต้องการ widget ในผลิตภัณฑ์ที่มีรายได้; ประเมิน Yahoo เฉพาะเมื่อมีสิทธิ์เป็น feed เสริม
5. เริ่ม signal ledger หลังเลือกแหล่งราคาและนโยบายผลแพ้ชนะของแต่ละตลาดแล้วเท่านั้น
