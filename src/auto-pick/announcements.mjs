const LETTERS = { A: 'เอ', B: 'บี', C: 'ซี', D: 'ดี', E: 'อี', F: 'เอฟ', G: 'จี', H: 'เอช', I: 'ไอ', J: 'เจ', K: 'เค', L: 'แอล', M: 'เอ็ม', N: 'เอ็น', O: 'โอ', P: 'พี', Q: 'คิว', R: 'อาร์', S: 'เอส', T: 'ที', U: 'ยู', V: 'วี', W: 'ดับเบิลยู', X: 'เอ็กซ์', Y: 'วาย', Z: 'แซด' };
const NAMES = { NVDA: 'เอ็นวีดีเอ', NVDA80: 'เอ็นวีดีเอ ดีอาร์', AAPL80: 'แอปเปิล ดีอาร์', PTT: 'พีทีที', AOT: 'เอโอที', CPALL: 'ซีพีออลล์', ADVANC: 'แอดวานซ์', KBANK: 'เคแบงก์', SCB: 'เอสซีบี', DELTA: 'เดลต้า', GULF: 'กัลฟ์' };

export const ANNOUNCEMENT_TYPES = new Set(['PICK_READY', 'ENTRY', 'TARGET', 'STOP', 'EXIT', 'AMBIGUOUS', 'DATA_GAP', 'SESSION_END']);
export const SPOKEN_TYPES = new Set(['PICK_READY', 'ENTRY', 'TARGET', 'STOP', 'EXIT']);

export function speakableSymbol(symbol = '') {
  const upper = String(symbol).toUpperCase();
  return NAMES[upper] || [...upper].map(letter => LETTERS[letter] || letter).join(' ');
}

export function announcementFor(item) {
  const symbol = item?.symbol || 'หุ้นที่ติดตาม';
  const name = speakableSymbol(symbol);
  const price = typeof item?.price === 'number' && Number.isFinite(item.price)
    ? item.price.toLocaleString('th-TH', { maximumFractionDigits: item.price < 1 ? 5 : 2 }) : null;
  const unit = item?.market === 'thai' || item?.market === 'dr' ? 'บาท' : item?.market === 'us' ? 'ดอลลาร์' : '';
  const atPrice = price ? ` ที่ราคาอ้างอิง ${price} ${unit}`.trimEnd() : '';
  const drSession = item?.session === 'night' ? 'ภาคค่ำ' : 'ภาคเช้า';
  const ceiling = typeof item?.entryCeiling === 'number' && Number.isFinite(item.entryCeiling)
    ? item.entryCeiling.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : null;
  const target = typeof item?.tp1 === 'number' && Number.isFinite(item.tp1) ? item.tp1.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : null;
  const stop = typeof item?.stopLoss === 'number' && Number.isFinite(item.stopLoss) ? item.stopLoss.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : null;
  switch (item?.type) {
    case 'PICK_READY': return { title: `เพิ่มในรายการจับตา · ${symbol}`, tone: 'watch', text: `${name} เข้ารายการจับตาของระบบแล้ว รอราคาเข้าเงื่อนไขก่อนนะ`, detail: item?.market === 'dr' ? `แผน DR ${drSession} · ยังไม่ใช่จุดเข้า · ต้องตรวจราคาเสนอขายก่อนซื้อ` : item?.market === 'us' ? 'แผนหุ้นสหรัฐฯ รายวัน · ยังไม่ใช่จุดเข้า' : 'พบแผนที่ผ่านกติกา · ยังไม่ใช่จุดเข้า' };
    case 'ENTRY': return item?.market === 'dr'
      ? { title: `DR เข้าเงื่อนไขเชิงเทคนิค · ${symbol}`, tone: 'entry',
        text: `น้องนักออมแจ้ง ${name} ${drSession} เข้าเงื่อนไขตามแผนแล้ว${atPrice} ${ceiling ? `ถ้าราคาเสนอขายเกิน ${ceiling} บาท ให้รอ ไม่ไล่ราคา` : 'เช็กราคาเสนอขายก่อนซื้อ'} ${target ? `เป้าหมาย ${target} บาท` : ''} ${stop ? `จุดตัดขาดทุน ${stop} บาท` : ''} เป็นราคาอ้างอิงจากแท่งปิด`,
        detail: `DR ${drSession} · ยืนยันจุดเข้าแล้ว · ${ceiling ? `ตรวจ ask ไม่เกิน ${ceiling} บาท` : 'ตรวจ ask ก่อนซื้อ'}${target && stop ? ` · TP ${target} / SL ${stop}` : ''} · ไม่ใช่ราคา fill` }
      : { title: `เข้าเงื่อนไขราคา · ${symbol}`, tone: 'entry', text: `จังหวะมาแล้ว ${name} เข้าเงื่อนไขตามแผน${atPrice} ${target ? `เป้าหมาย ${target} ${unit}` : ''} ${stop ? `จุดตัดขาดทุน ${stop} ${unit}` : ''} ตรวจแผนก่อนตัดสินใจนะ`, detail: item?.market === 'us' ? 'ยืนยันจากราคาปิดแท่งรายวัน · การแจ้งอาจมาหลังตลาดปิด' : 'ราคาอ้างอิงจากแท่งที่ปิดแล้ว' };
    case 'TARGET': return { title: `แตะเป้าหมาย TP1 · ${symbol}`, tone: 'target', text: `${name} ถึงเป้าหมายแรกแล้ว${atPrice} ใครตามแผนอยู่ ลองเช็กกำไรของตัวเองกันนะ`, detail: item?.market === 'us' ? 'แตะระดับตามช่วงแท่งรายวัน · อาจแจ้งหลังตลาดปิด' : 'แตะระดับเป้าตามข้อมูลแท่ง · ไม่ใช่กำไรของทุกบัญชี' };
    case 'STOP': return { title: `แตะจุดตัดขาดทุน · ${symbol}`, tone: 'stop', text: `${name} แตะจุดตัดขาดทุนแล้ว${atPrice} ตรวจความเสี่ยงของแผนกัน`, detail: item?.market === 'us' ? 'แตะระดับตามช่วงแท่งรายวัน · อาจแจ้งหลังตลาดปิด' : 'แตะระดับตัดขาดทุนตามข้อมูลแท่ง' };
    case 'EXIT': return { title: `จบแผนตามเงื่อนไข · ${symbol}`, tone: 'review', text: `${name} ถึงเงื่อนไขจบแผน${atPrice} ตรวจราคาซื้อขายของตนเองด้วยนะ`, detail: item?.detail || 'ราคาอ้างอิงจากแท่งที่ปิดแล้ว' };
    case 'AMBIGUOUS': return { title: `ต้องตรวจลำดับราคา · ${symbol}`, tone: 'review', text: '', detail: 'แท่งเดียวแตะทั้ง TP1 และ SL · ยังสรุปผลไม่ได้' };
    case 'DATA_GAP': return { title: `ข้อมูลขาดช่วง · ${symbol}`, tone: 'review', text: '', detail: item?.detail || 'พักการสรุปผลจนตรวจข้อมูลย้อนหลัง' };
    case 'SESSION_END': return { title: `จบช่วงติดตาม · ${symbol}`, tone: 'review', text: '', detail: item?.detail || 'ยังไม่ถึง TP1 หรือ SL · รอตรวจผล' };
    default: return { title: `${symbol} · อัปเดตแผน`, tone: 'review', text: '', detail: item?.detail || '' };
  }
}
