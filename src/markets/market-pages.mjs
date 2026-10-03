export const MARKET_PAGES = [
  {id:'thai',href:'/thai',label:'หุ้นไทย',short:'TH',title:'เช้าวันใหม่ จับจังหวะหุ้นไทย',description:'SET100 และ mai · สแกนรายวัน ดูกราฟ และติดตามจังหวะที่ระบบพบ',eyebrow:'THAI EQUITY / MORNING DESK',accent:'#72dfb3',rgb:'114,223,179'},
  {id:'dr',href:'/dr',label:'DR',short:'DR',title:'DR Strategy Tracker',description:'โต๊ะติดตามหุ้นต่างประเทศผ่าน DR · แผน จุดเข้า เป้าหมาย และผลลัพธ์ในที่เดียว',eyebrow:'NUGAOM / AI RESEARCH',accent:'#f2be62',rgb:'242,190,98'},
  {id:'tfex',href:'/tfex',label:'TFEX',short:'TF',title:'อ่านสัญญา ก่อนเลือกจังหวะ',description:'SET50 · Gold · Silver · ดูกราฟและรายละเอียดเดือนสัญญา',eyebrow:'DERIVATIVES / CONTRACT DESK',accent:'#ff9970',rgb:'255,153,112'},
  {id:'us',href:'/us',label:'หุ้นเมกา',short:'US',title:'มองตลาดโลกให้ชัดขึ้น',description:'หุ้นสภาพคล่องสูง 500 ตัวจาก 3 เดือนล่าสุด · สแกนรายวัน ข่าว และผลงานที่ตรวจสอบได้',eyebrow:'US EQUITY / GLOBAL DESK',accent:'#7faeff',rgb:'127,174,255'},
  {id:'forex',href:'/forex',label:'Forex',short:'FX',title:'คู่เงิน จังหวะ และภาพเศรษฐกิจ',description:'19 สินค้า · กราฟย้อนหลัง ข่าวเศรษฐกิจ และเครื่องมือวิเคราะห์',eyebrow:'CURRENCIES / MACRO DESK',accent:'#bc9bff',rgb:'188,155,255'},
];
export const marketPage = id => MARKET_PAGES.find(page=>page.id===id) ?? MARKET_PAGES[0];
export const marketHref = (id,symbol) => `${marketPage(id).href}${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`;
