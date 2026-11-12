// Browser adapter with dual-tier Thai TTS:
// Tier 1: Neural Studio Thai TTS (/api/tts via Edge-TTS / Hugging Face MMS-TTS)
// Tier 2: Browser SpeechSynthesis (th-TH) instant zero-delay fallback
// Text verbalizer: Translates market abbreviations and numbers into natural spoken Thai.

const THAI_LETTERS = {
  A: 'เอ', B: 'บี', C: 'ซี', D: 'ดี', E: 'อี', F: 'เอฟ', G: 'จี', H: 'เอช', I: 'ไอ',
  J: 'เจ', K: 'เค', L: 'แอล', M: 'เอ็ม', N: 'เอ็น', O: 'โอ', P: 'พี', Q: 'คิว', R: 'อาร์',
  S: 'เอส', T: 'ที', U: 'ยู', V: 'วี', W: 'ดับเบิลยู', X: 'เอ็กซ์', Y: 'วาย', Z: 'แซด',
};

export const STOCK_SPOKEN_NAMES = {
  PTT: 'พีทีที', PTTEP: 'พีทีทีอีพี', PTTGC: 'พีทีทีจีซี', OR: 'โออาร์', TOP: 'ไทยออยล์',
  SPRC: 'เอสพีอาร์ซี', BCP: 'บางจาก', BANPU: 'บ้านปู', IRPC: 'ไออาร์พีซี',
  CPALL: 'ซีพีออลล์', CPF: 'ซีพีเอฟ', CPAXT: 'ซีพีแอ็กซ์ตร้า', CRC: 'ซีอาร์ซี', CPN: 'ซีพีเอ็น',
  HMPRO: 'โฮมโปร', GLOBAL: 'โกลบอลเฮ้าส์', DOHOME: 'ดูโฮม', COM7: 'คอมเซเว่น', BJC: 'บีเจซี',
  ADVANC: 'แอดวานซ์', TRUE: 'ทรู', JMART: 'เจมาร์ท', JMT: 'เจเอ็มที',
  DELTA: 'เดลต้า', HANA: 'ฮานา', KCE: 'เคซีอี', CCET: 'ซีซีอีที',
  GULF: 'กัลฟ์', GPSC: 'จีพีเอสซี', BGRIM: 'บีกริม', EGCO: 'เอ็กโก', RATCH: 'ราชกรุ๊ป',
  EA: 'อีเอ', GUNKUL: 'กันกุล',
  KBANK: 'เคแบงก์', SCB: 'เอสซีบี', BBL: 'แบงก์กรุงเทพ', KTB: 'กรุงไทย', TTB: 'ทีทีบี',
  TISCO: 'ทิสโก้', KKP: 'เกียรตินาคิน', TCAP: 'ทีแคป',
  MTC: 'เอ็มทีซี', SAWAD: 'ศรีสวัสดิ์', TIDLOR: 'ติดล้อ', KTC: 'เคทีซี', AEONTS: 'อิออน', BAM: 'แบม',
  AOT: 'เอโอที', BDMS: 'บีดีเอ็มเอส', BH: 'บำรุงราษฎร์', BCH: 'บีซีเอช', CHG: 'จุฬารัตน์', PR9: 'พระรามเก้า',
  BEM: 'บีอีเอ็ม', BTS: 'บีทีเอส', MINT: 'ไมเนอร์', CENTEL: 'เซ็นเทล', AWC: 'เอดับบลิวซี', ERW: 'เอราวัณ',
  WHA: 'ดับบลิวเอชเอ', AMATA: 'อมตะ', LH: 'แลนด์แอนด์เฮ้าส์', SIRI: 'แสนสิริ', SPALI: 'ศุภาลัย', AP: 'เอพี', QH: 'คิวเฮ้าส์',
  SCC: 'ปูนใหญ่', SCGP: 'เอสซีจีพี', IVL: 'ไอวีแอล', TU: 'ไทยยูเนี่ยน', ITC: 'ไอทีซี',
  OSP: 'โอสถสภา', CBG: 'คาราบาว', ICHI: 'อิชิตัน', SNNP: 'เอสเอ็นเอ็นพี', AU: 'อาฟเตอร์ยู',
  WARRIX: 'วอริกซ์', MASTER: 'มาสเตอร์', BBIK: 'บลูบิค', DITTO: 'ดิทโต้', PLANB: 'แพลนบี', VGI: 'วีจีไอ',
  STA: 'เอสทีเอ', STGT: 'เอสทีจีที', RCL: 'อาร์ซีแอล', PRM: 'พริมา', BA: 'บางกอกแอร์', AAV: 'แอร์เอเชีย',
  NVDA80: 'เอ็นวีดีเอ ดีอาร์', AAPL80: 'แอปเปิล ดีอาร์', TSLA80: 'เทสลา ดีอาร์', MSFT80: 'ไมโครซอฟท์ ดีอาร์',
  BABA80: 'อาลีบาบา ดีอาร์', GOOG80: 'กูเกิล ดีอาร์', TENCENT80: 'เทนเซ็นต์ ดีอาร์', AMD80: 'เอเอ็มดี ดีอาร์',
  NVDA: 'เอ็นวีดีเอ', AAPL: 'แอปเปิล', TSLA: 'เทสลา', MSFT: 'ไมโครซอฟท์', META: 'เมตา', AMZN: 'แอมะซอน', GOOGL: 'กูเกิล',
  XAUUSD: 'ทองคำ เอ็กซ์เอยู', EURUSD: 'ยูโรดอลลาร์', GBPUSD: 'ปอนด์ดอลลาร์', USDJPY: 'ดอลลาร์เยน',
};

export function speakableThaiTicker(symbol = '') {
  const clean = String(symbol || '').trim().toUpperCase().replace(/\.BK$/i, '');
  if (!clean) return 'หุ้นที่เลือก';
  if (STOCK_SPOKEN_NAMES[clean]) return STOCK_SPOKEN_NAMES[clean];
  if (clean.endsWith('80') && STOCK_SPOKEN_NAMES[clean.slice(0, -2)]) {
    return `${STOCK_SPOKEN_NAMES[clean.slice(0, -2)]} ดีอาร์`;
  }
  return [...clean].map(ch => THAI_LETTERS[ch] || ch).join(' ');
}

export function buildStockSupportResistanceSpeech(row) {
  if (!row) return '';
  const name = speakableThaiTicker(row.symbol);
  const p = Number(row.price);
  const support = Number(row.plan?.entry ?? row.support ?? (p > 0 ? (p * 0.975).toFixed(2) : 0));
  const stop = Number(row.plan?.stopLoss ?? row.stop ?? (p > 0 ? (p * 0.94).toFixed(2) : 0));
  const target1 = Number(row.plan?.minimumTarget ?? row.target1 ?? (p > 0 ? (p * 1.08).toFixed(2) : 0));
  const target2 = Number(row.target2 ?? (support > 0 && stop > 0 ? (support + (support - stop) * 2.5).toFixed(2) : (p * 1.15).toFixed(2)));
  const fmt = v => Number.isFinite(v) && v > 0 ? Number(v.toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : 'รอข้อมูล';

  return `เช็คแนวรับแนวต้านหุ้น ${name} ราคาปัจจุบัน ${fmt(p)} บาท โซนแนวรับปลอดภัย ${fmt(support)} บาท แนวต้านเป้าแรก ${fmt(target1)} บาท แนวต้านถัดไป ${fmt(target2)} บาท และจุดคัทลอสหากหลุด ${fmt(stop)} บาท`;
}

export function isEveningHomeworkUnlocked(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const findVal = type => parts.find(p => p.type === type)?.value;
  const weekday = findVal('weekday');
  const hour = Number(findVal('hour') || 0);
  const minute = Number(findVal('minute') || 0);

  // Weekend (Sat/Sun): Market is closed, homework is fully accessible anytime
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { unlocked: true, hour, minute, weekday, unlockTimeText: '17:30 น.' };
  }

  // Weekdays (Mon-Fri): Unlocked after 17:30 Bangkok time (17:30 to 23:59 or early morning before 08:30)
  const totalMinutes = hour * 60 + minute;
  const isUnlocked = totalMinutes >= (17 * 60 + 30) || totalMinutes < (8 * 60 + 30);
  return {
    unlocked: isUnlocked,
    hour,
    minute,
    weekday,
    unlockTimeText: '17:30 น.',
  };
}

export function buildMorningBriefSpeech(rows = [], regime = 'ตลาดผสม') {
  const valid = (rows || []).filter(r => r && r.plan && Number.isFinite(r.price) && !['unavailable', 'stale'].includes(r.status));
  const picks = [...valid]
    .sort((a, b) => ((b.volumeBreakout ? 2 : 0) + (b.templatePass ? 2 : 0) + (b.score ?? 0)) - ((a.volumeBreakout ? 2 : 0) + (a.templatePass ? 2 : 0) + (a.score ?? 0)))
    .slice(0, 3);

  if (!picks.length) {
    return 'สวัสดีตอนเช้าค่ะ ขณะนี้กำลังรอผลสแกนหุ้นเข้าแผนรอบเช้า กรุณากดโหลดข้อมูลล่าสุดสักครู่ค่ะ';
  }
  const fmt = v => Number(Number(v).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const parts = picks.map((item, idx) => {
    const name = speakableThaiTicker(item.symbol);
    return `ตัวที่ ${idx + 1} ${name} แนวรับจุดเข้า ${fmt(item.plan.entry)} บาท เป้าแนวต้าน ${fmt(item.plan.minimumTarget)} บาท จุดคัท ${fmt(item.plan.stopLoss)} บาท`;
  });
  return `โพยหุ้นเด่นเช้านี้เล่นอะไรดี รอบเก้าโมงครึ่ง ภาวะตลาด ${regime} คัดหุ้นเข้าแผน ${picks.length} ตัวเน้นๆ ${parts.join(' ')} วางแผนตามกรอบสองอาร์และคุมความเสี่ยงทุกไม้นะคะ`;
}

export function buildEveningHomeworkSpeech(rows = [], regime = 'ตลาดผสม', options = {}) {
  const timeGate = options.bypassTimeGate ? { unlocked: true } : isEveningHomeworkUnlocked(options.now);
  if (!timeGate.unlocked) {
    return 'ขณะนี้ตลาดกำลังเปิดทำการค่ะ การบ้านหุ้นรอบเย็นจะเริ่มประมวลผลอัตโนมัติเวลา 17:30 น. หลังตลาดปิด เพื่อคัดกรองหุ้นตามราคาปิดจริงและไม่ซ้ำรอบเช้าค่ะ';
  }

  const valid = (rows || []).filter(r => r && r.plan && Number.isFinite(r.price) && !['unavailable', 'stale'].includes(r.status));
  const morningExclude = new Set((options.morningPicks || []).map(p => p.symbol));
  const pool = valid.filter(r => !morningExclude.has(r.symbol));
  const candidatePool = pool.length > 0 ? pool : valid;

  const stage2Pick = candidatePool.find(r => r.stage === 2 && r.templatePass) || candidatePool[0];
  const pullbackPick = candidatePool.find(r => r.pullback && r.symbol !== stage2Pick?.symbol) || candidatePool.find(r => r.symbol !== stage2Pick?.symbol);
  const breakoutPick = candidatePool.find(r => r.volumeBreakout && r.symbol !== stage2Pick?.symbol && r.symbol !== pullbackPick?.symbol)
    || candidatePool.find(r => r.symbol !== stage2Pick?.symbol && r.symbol !== pullbackPick?.symbol);

  const picks = [
    stage2Pick ? { tag: 'สายต้นน้ำขาขึ้น', item: stage2Pick } : null,
    pullbackPick ? { tag: 'สายย่อรับแนวรับ', item: pullbackPick } : null,
    breakoutPick ? { tag: 'สายวอลุ่มเข้าจ่อเบรก', item: breakoutPick } : null,
  ].filter(Boolean);

  if (!picks.length) {
    return 'สรุปการบ้านหุ้นเย็นนี้ รอบห้าโมงครึ่ง ขณะนี้กำลังรอข้อมูลราคาปิดประจำวัน กรุณากดโหลดข้อมูลล่าสุดค่ะ';
  }
  const fmt = v => Number(Number(v).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const parts = picks.map(({ tag, item }) => {
    const name = speakableThaiTicker(item.symbol);
    return `${tag} หุ้น ${name} แนวรับเฝ้ารับ ${fmt(item.plan.entry)} บาท แนวต้าน ${fmt(item.plan.minimumTarget)} บาท จุดคัท ${fmt(item.plan.stopLoss)} บาท`;
  });
  return `การบ้านหุ้นเย็นนี้เตรียมเฝ้าพรุ่งนี้ รอบห้าโมงครึ่ง คัดชุดใหม่ไม่ซ้ำรอบเช้า ภาวะตลาด ${regime} ${parts.join(' ')} จดเข้าลิสต์เฝ้าเปิดตลาดพรุ่งนี้เช้าได้เลยค่ะ`;
}

export function buildDrMorningBriefSpeech(drRows = []) {
  const picks = (drRows || []).filter(Boolean).slice(0, 3);
  if (!picks.length) {
    return 'สวัสดีตอนเช้าค่ะ โพยดีอาร์รอบเก้าโมงครึ่ง กำลังซิงก์ราคาหุ้นแม่จากต่างประเทศ กรุณารอสักครู่ค่ะ';
  }
  const fmt = v => Number(Number(v).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const parts = picks.map((item, idx) => {
    const name = speakableThaiTicker(item.symbol);
    const support = item.support ?? item.plan?.entry ?? (item.thbPrice ? item.thbPrice * 0.97 : 0);
    const target = item.target1 ?? item.plan?.minimumTarget ?? (item.thbPrice ? item.thbPrice * 1.07 : 0);
    const stop = item.stop ?? item.plan?.stopLoss ?? (item.thbPrice ? item.thbPrice * 0.94 : 0);
    return `ตัวที่ ${idx + 1} ${name} แนวรับจุดเข้า ${fmt(support)} บาท เป้าแนวต้าน ${fmt(target)} บาท จุดคัท ${fmt(stop)} บาท`;
  });
  return `โพยดีอาร์เด่นเช้านี้เล่นอะไรดี รอบเก้าโมงครึ่ง คัดดีอาร์ตามทิศทางหุ้นแม่ต่างประเทศ ${picks.length} ตัว ${parts.join(' ')} เช็คราคายุติธรรมก่อนตั้งรับทุกครั้งนะคะ`;
}

export function buildDrEveningHomeworkSpeech(drRows = [], options = {}) {
  const timeGate = options.bypassTimeGate ? { unlocked: true } : isEveningHomeworkUnlocked(options.now);
  if (!timeGate.unlocked) {
    return 'ขณะนี้ตลาดกำลังเปิดทำการค่ะ การบ้านดีอาร์รอบเย็นจะเริ่มประมวลผลอัตโนมัติเวลา 17:30 น. หลังตลาดปิด เพื่อคัดกรองดีอาร์ชุดใหม่ที่ไม่ซ้ำรอบเช้าค่ะ';
  }

  const morningExclude = new Set((options.drMorningPicks || []).map(p => p.symbol));
  const valid = (drRows || []).filter(Boolean);
  const pool = valid.filter(r => !morningExclude.has(r.symbol));
  const candidatePool = pool.length > 0 ? pool : valid;
  const picks = candidatePool.slice(0, 3);

  if (!picks.length) {
    return 'สรุปการบ้านดีอาร์เย็นนี้ รอบห้าโมงครึ่ง กำลังรอข้อมูลปิดตลาดค่ะ';
  }
  const fmt = v => Number(Number(v).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const tags = ['สายเทคขาขึ้น', 'สายย่อรับใกล้แฟร์แวลู', 'สายดักฟื้นตัวตามหุ้นแม่'];
  const parts = picks.map((item, idx) => {
    const name = speakableThaiTicker(item.symbol);
    const support = item.support ?? item.plan?.entry ?? (item.thbPrice ? item.thbPrice * 0.97 : 0);
    const target = item.target1 ?? item.plan?.minimumTarget ?? (item.thbPrice ? item.thbPrice * 1.07 : 0);
    const stop = item.stop ?? item.plan?.stopLoss ?? (item.thbPrice ? item.thbPrice * 0.94 : 0);
    return `${tags[idx] || `ตัวที่ ${idx + 1}`} ${name} แนวรับเฝ้ารับ ${fmt(support)} บาท แนวต้าน ${fmt(target)} บาท จุดคัท ${fmt(stop)} บาท`;
  });
  return `การบ้านดีอาร์เย็นนี้ รอบห้าโมงครึ่ง คัดดีอาร์ชุดใหม่ไม่ซ้ำรอบเช้า เตรียมเฝ้าคืนนี้และพรุ่งนี้เช้า ${parts.join(' ')} จดเข้าลิสต์เฝ้าได้เลยค่ะ`;
}

export function buildDrSupportResistanceSpeech(item) {
  if (!item) return '';
  const name = speakableThaiTicker(item.symbol);
  const fmt = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(Number(v).toFixed(2)).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : 'รอข้อมูล';
  const price = item.thbPrice ?? item.price ?? 0;
  const fair = item.fairThb ?? price;
  const support = item.support ?? item.plan?.entry ?? (price * 0.97);
  const target1 = item.target1 ?? item.plan?.minimumTarget ?? (price * 1.07);
  const target2 = item.target2 ?? (price * 1.13);
  const stop = item.stop ?? item.plan?.stopLoss ?? (price * 0.94);
  return `เช็คแนวรับแนวต้านดีอาร์ ${name} ราคาในกระดาน ${fmt(price)} บาท ราคายุติธรรมเทียบหุ้นแม่ ${fmt(fair)} บาท โซนแนวรับปลอดภัย ${fmt(support)} บาท แนวต้านเป้าแรก ${fmt(target1)} บาท แนวต้านถัดไป ${fmt(target2)} บาท และจุดคัทลอสหากหลุด ${fmt(stop)} บาท`;
}

export function formatForThaiSpeech(text) {
  if (typeof text !== 'string') return '';
  let result = text
    // Strip bracketed news tags
    .replace(/\[\s*(?:มีคลิป|คลิป|ชมคลิป|ด่วน|LIVE|สด|อัปเดต|update).*?\]/gi, '')
    .replace(/\(\s*(?:มีคลิป|คลิป|ชมคลิป|ด่วน|LIVE|สด|อัปเดต|update).*?\)/gi, '')
    // Strip publisher trailing pipes
    .replace(/\|\s*(?:ข่าวหุ้นธุรกิจ|ข่าวหุ้นธุรกิจออนไลน์|Kaohoon|InfoQuest|อินโฟเควสท์|CNBC).*$/gi, '')
    // Trading abbreviations to spoken Thai
    .replace(/\bTP1\b/gi, 'ทีพี หนึ่ง')
    .replace(/\bTP2\b/gi, 'ทีพี สอง')
    .replace(/\bTP\b/gi, 'ทีพี')
    .replace(/\bSL\b/gi, 'สต็อปลอส')
    .replace(/\b2R\b/gi, 'สองอาร์')
    .replace(/\b1R\b/gi, 'หนึ่งอาร์')
    .replace(/\b3R\b/gi, 'สามอาร์')
    .replace(/\bEMA\s*20\/50\b/gi, 'อีเอ็มเอ 20 และ 50')
    .replace(/\bEMA\s*20\b/gi, 'อีเอ็มเอ 20')
    .replace(/\bEMA\s*50\b/gi, 'อีเอ็มเอ 50')
    .replace(/\bEMA\s*200\b/gi, 'อีเอ็มเอ 200')
    .replace(/\b15m\b/gi, '15 นาที')
    .replace(/\b4H\b/gi, '4 ชั่วโมง')
    .replace(/\bD1\b/gi, 'เดย์')
    .replace(/\bSHORT\b/g, 'ชอร์ต')
    .replace(/\bLONG\b/g, 'ลอง')
    .replace(/\bSET100\b/gi, 'เซ็ต 100')
    .replace(/\bSET50\b/gi, 'เซ็ต 50')
    .replace(/\bSET\b/g, 'เซ็ต')
    .replace(/\bTFEX\b/gi, 'ทีเฟกซ์')
    .replace(/\bDR80\b/gi, 'ดีอาร์ 80')
    .replace(/\bDR\b/g, 'ดีอาร์')
    // Strip ticker suffixes
    .replace(/([A-Za-z0-9]+)\.BK\b/g, '$1')
    // Punctuation and symbols
    .replace(/%/g, ' เปอร์เซ็นต์ ');

  // Replace known stock ticker symbols with natural Thai spoken names when embedded in Thai speech
  if (/[\u0E00-\u0E7F]/.test(result)) {
    result = result.replace(/\b([A-Z]{2,10}(?:80)?)\b/g, (match) => {
      return STOCK_SPOKEN_NAMES[match] || match;
    });
  }

  return result.replace(/\s+/g, ' ').trim();
}

export function createSignalSpeaker(browser, onState = () => { }, options = {}) {
  let generation = 0;
  let current = null;
  let currentAudio = null;
  let sharedAudio = null;

  const hasSynthesis = Boolean(browser?.speechSynthesis && typeof browser?.SpeechSynthesisUtterance === 'function');
  const AudioCtor = browser?.Audio || (typeof Audio !== 'undefined' ? Audio : null);
  const hasAudio = Boolean(AudioCtor && options.useAudio !== false);
  const supported = hasSynthesis || hasAudio;

  function unlock() {
    if (hasAudio && !sharedAudio) {
      try {
        const a = new AudioCtor('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        a.playsInline = true;
        a.volume = 0;
        const p = a.play?.();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (currentAudio !== a) {
              try { a.pause(); a.currentTime = 0; } catch { }
              a.volume = 1;
            }
          }).catch(() => {
            a.volume = 1;
          });
        } else {
          a.volume = 1;
        }
        sharedAudio = a;
      } catch { }
    }
    if (hasSynthesis && !current) {
      try {
        const u = new browser.SpeechSynthesisUtterance('');
        u.volume = 0;
        u.lang = 'th-TH';
        browser.speechSynthesis.speak?.(u);
      } catch { }
    }
  }

  function stop() {
    generation += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch { }
      currentAudio = null;
    }
    current = null;
    if (hasSynthesis) {
      try {
        browser.speechSynthesis.cancel();
      } catch { }
    }
    onState('idle', { reason: 'stopped' });
  }

  function playSynthesis(text, ticket) {
    if (!hasSynthesis) {
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {}
      currentAudio = null;
    }
    const synthesis = browser.speechSynthesis;
    try {
      synthesis.cancel();
      const utterance = new browser.SpeechSynthesisUtterance(text);
      current = utterance;
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      utterance.pitch = 1.03;
      utterance.voice = synthesis.getVoices?.().find(voice => voice.lang.toLowerCase().startsWith('th')) || null;
      const settle = (state, reason) => {
        if (ticket !== generation) return;
        current = null;
        onState(state, { reason });
      };
      utterance.onstart = () => { if (ticket === generation) onState('speaking'); };
      utterance.onend = () => settle('idle', 'ended');
      utterance.onerror = event => settle(event.error === 'not-allowed' ? 'blocked' : 'failed');
      onState('starting');
      synthesis.speak(utterance);
      return true;
    } catch {
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
  }

  function playAudio(text, ticket) {
    try {
      if (currentAudio && currentAudio !== sharedAudio) {
        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        } catch {}
        currentAudio = null;
      }
      if (hasSynthesis) {
        try { browser.speechSynthesis.cancel(); } catch {}
      }
      const url = `/api/tts?text=${encodeURIComponent(text)}`;
      let audio;
      if (sharedAudio) {
        audio = sharedAudio;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
        audio.volume = 1;
        audio.src = url;
        audio.load?.();
      } else {
        audio = new AudioCtor(url);
        audio.playsInline = true;
      }
      currentAudio = audio;
      current = audio;

      let started = false;
      const settle = (state, reason) => {
        if (ticket !== generation) return;
        if (currentAudio === audio) currentAudio = null;
        current = null;
        onState(state, { reason });
      };

      audio.onplay = () => {
        if (ticket !== generation) return;
        started = true;
        onState('speaking');
      };

      audio.onended = () => settle('idle', 'ended');

      audio.onerror = () => {
        if (ticket !== generation) return;
        if (currentAudio === audio) currentAudio = null;
        if (hasSynthesis && !started) {
          playSynthesis(text, ticket);
        } else {
          settle('failed', 'audio_error');
        }
      };

      onState('starting');
      const p = audio.play?.();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          if (ticket !== generation) return;
          if (hasSynthesis && !started && err?.name !== 'NotAllowedError') {
            playSynthesis(text, ticket);
          } else if (err?.name === 'NotAllowedError') {
            settle('blocked', 'not-allowed');
          } else if (hasSynthesis && !started) {
            playSynthesis(text, ticket);
          } else {
            settle('failed', err?.message || 'play_error');
          }
        });
      }
      return true;
    } catch {
      if (hasSynthesis) {
        return playSynthesis(text, ticket);
      }
      if (ticket === generation) {
        current = null;
        onState('failed');
      }
      return false;
    }
  }

  let api = null;

  function play(text) {
    if (!supported || !text) {
      onState('unsupported');
      return false;
    }
    const spokenText = formatForThaiSpeech(text);
    if (!spokenText) {
      onState('unsupported');
      return false;
    }
    if (browser && browser.__activeSignalSpeaker && browser.__activeSignalSpeaker !== api) {
      try {
        browser.__activeSignalSpeaker.stop();
      } catch {}
    }
    if (browser) {
      browser.__activeSignalSpeaker = api;
    }
    const ticket = ++generation;

    const preferAudio = hasAudio && options.engine !== 'synthesis';
    if (preferAudio) {
      return playAudio(spokenText, ticket);
    }
    return playSynthesis(spokenText, ticket);
  }

  api = {
    play,
    stop,
    unlock,
    supported,
    get pending() {
      return current !== null;
    },
  };

  return api;
}
