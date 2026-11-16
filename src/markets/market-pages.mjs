export const MARKET_PAGES = [
  {id:'thai',href:'/thai',label:'หุ้นไทย',short:'TH',featured:true,tag:'ยอดนิยม',badge:'HOT',title:'เช้าวันใหม่ จับจังหวะหุ้นไทย',description:'SET100 และ mai · สแกนรายวัน ดูกราฟ และติดตามจังหวะที่ระบบพบ',eyebrow:'THAI EQUITY / MORNING DESK',accent:'#72dfb3',rgb:'114,223,179'},
  {id:'dr',href:'/dr',label:'DR',short:'DR',featured:true,tag:'GLOBAL',badge:'AI',title:'DR Strategy Tracker',description:'โต๊ะติดตามหุ้นต่างประเทศผ่าน DR · แผน จุดเข้า เป้าหมาย และผลลัพธ์ในที่เดียว',eyebrow:'NUGAOM / AI RESEARCH',accent:'#f2be62',rgb:'242,190,98'},
  {id:'tfex',href:'/tfex',label:'TFEX',short:'TF',title:'อ่านสัญญา ก่อนเลือกจังหวะ',description:'SET50 · Gold · Silver · ดูกราฟและรายละเอียดเดือนสัญญา',eyebrow:'DERIVATIVES / CONTRACT DESK',accent:'#ff9970',rgb:'255,153,112'},
  {id:'us',href:'/us',label:'หุ้นสหรัฐฯ',short:'US',title:'US Stocks & Global ETFs',description:'S&P 500 & Thematic ETFs · สแกนหุ้นผู้นำ Stage 2, Sector Rotation และคำนวณความเสี่ยงค่าเงิน USD/THB',eyebrow:'WALL STREET / US STAGE 2 COMMAND DESK',accent:'#38bdf8',rgb:'56,189,248'},
];
export const VISIBLE_MARKET_PAGES = MARKET_PAGES.filter(page => !page.hidden);
export const marketPage = id => MARKET_PAGES.find(page=>page.id===id) ?? MARKET_PAGES[0];
export const marketHref = (id,symbol) => `${marketPage(id).href}${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`;
