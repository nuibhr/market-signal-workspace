import { rateLimit, readJsonBody, requestErrorResponse } from '../../../security/request-guard.mjs';
import { SETTRADE_SYMBOLS } from '../../../markets/catalog.mjs';
import { currentMember, sameOrigin } from '../../../membership/server.mjs';
import { membershipFor } from '../../../membership/rights.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };
const CACHE_MS = 5 * 60_000;
const cache = new Map();
const pending = new Map();
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    risk: { type: 'string' },
  },
  required: ['summary', 'risk'],
};

function validNumber(value, { positive = false } = {}) {
  return typeof value === 'number' && Number.isFinite(value) && (!positive || value > 0);
}

function parseSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const symbol = typeof input.symbol === 'string' ? input.symbol.toUpperCase() : '';
  if (!SETTRADE_SYMBOLS.has(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(input.latestDay ?? '')) return null;
  const timeframe = ['15m', '1h', '4h', '1d'].includes(input.timeframe) ? input.timeframe : null;
  if (!timeframe) return null;
  const latestTime = timeframe === '1d' ? null : input.latestTime;
  if (timeframe !== '1d' && (typeof latestTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(latestTime)
    || !Number.isFinite(Date.parse(latestTime)))) return null;
  if (!Number.isInteger(input.barCount) || input.barCount < 50 || input.barCount > 5_000) return null;
  const numbers = ['price', 'support', 'resistance', 'ema20', 'ema50', 'rsi14', 'macdHistogram'];
  if (numbers.some(key => !validNumber(input[key], { positive: key !== 'macdHistogram' }))) return null;
  if (input.rsi14 < 0 || input.rsi14 > 100 || !['up', 'down', 'sideways'].includes(input.trend)) return null;
  return { ...Object.fromEntries(['symbol', 'latestDay', 'barCount', ...numbers, 'trend'].map(key => [key, key === 'symbol' ? symbol : input[key]])), timeframe, latestTime };
}

function validateNarrative(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = ['summary', 'risk'];
  if (fields.some(key => typeof value[key] !== 'string' || value[key].trim().length < 3 || value[key].length > 300)) return null;
  return { summary: value.summary.trim(), risk: value.risk.trim() };
}

async function generate(snapshot) {
  const model = process.env.OLLAMA_MODEL?.trim() || 'qwen3:4b';
  const intervalLabel = { '15m': '15 นาที', '1h': '1 ชั่วโมง', '4h': '4 ชั่วโมง', '1d': 'รายวัน' }[snapshot.timeframe];
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: outputSchema,
      options: { temperature: 0, num_predict: 400 },
      system: 'คุณเป็นผู้ช่วยอธิบายข้อมูลเทคนิคหุ้นไทยอย่างระมัดระวัง ตอบภาษาไทยสั้นและชัดเจนโดยใช้เฉพาะข้อมูลที่ได้รับ มีแท่งข้อมูลเพียงพอสำหรับคำนวณอินดิเคเตอร์ที่แสดงแล้ว ห้ามบอกว่าจำนวนแท่งไม่พอ ห้ามอ้างข่าว พื้นฐานบริษัท โอกาสชนะ ความแม่นยำ กำไรที่คาด หรือข้อมูลที่ไม่มีใน snapshot ห้ามแนะนำให้ซื้อ ขาย หรือส่งคำสั่ง ห้ามสร้างระดับราคาหรือตัวเลขใหม่ ห้ามสร้างเงื่อนไขแผนเอง แผนและจุดสแกนบนหน้าจอคำนวณแยกด้วยกติกาอยู่แล้ว คุณเขียนเพียงคำอธิบายแนวโน้มและข้อจำกัดของข้อมูลในช่วงเวลาที่ระบุ คืน JSON ตาม schema เท่านั้น',
      prompt: `อธิบายภาพเทคนิคจากแท่ง ${intervalLabel} ใน snapshot นี้: ${JSON.stringify(snapshot)}\nให้ summary อธิบายแนวโน้มปัจจุบันอย่างสั้นโดยไม่สร้างแผนหรือเงื่อนไขใหม่ ให้ risk อธิบายข้อจำกัดของแท่ง ${intervalLabel} และอินดิเคเตอร์ รวมถึงแท่งล่าสุดที่อาจยังไม่ปิด ห้ามเพิ่มตัวเลขใหม่`,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error('MODEL_UNAVAILABLE');
  const payload = await response.json();
  let parsed;
  try { parsed = JSON.parse(payload.response ?? '{}'); } catch { throw new Error('INVALID_MODEL_RESPONSE'); }
  const narrative = validateNarrative(parsed);
  if (!narrative) throw new Error('INVALID_MODEL_RESPONSE');
  return { status: 'available', provider: 'Ollama local', model, latestDay: snapshot.latestDay, latestTime: snapshot.latestTime, timeframe: snapshot.timeframe, generatedAt: new Date().toISOString(), narrative };
}

export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ status: 'forbidden', code: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  const member = await currentMember();
  if (!membershipFor(member).capabilities.manualDailyScan) {
    return Response.json({ status: 'forbidden', code: 'MEMBERSHIP_REQUIRED' }, { status: 403, headers: NO_STORE });
  }
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ status: 'unavailable', code: 'LOCAL_MODEL_ONLY' }, { status: 503, headers: NO_STORE });
  }
  const limited = rateLimit('chart-ai', member.id, 6); if (limited) return limited;
  let snapshot;
  try { snapshot = parseSnapshot(await readJsonBody(request,3000)); } catch (error) { return requestErrorResponse(error); }
  if (!snapshot) return Response.json({ status: 'unavailable', code: 'INVALID_INPUT' }, { status: 400, headers: NO_STORE });
  const key = JSON.stringify(snapshot);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Response.json(hit.payload, { headers: NO_STORE });
  try {
    if (!pending.has(key)) pending.set(key, generate(snapshot));
    const result = await pending.get(key);
    cache.set(key, { payload: result, expiresAt: Date.now() + CACHE_MS });
    if (cache.size > 50) cache.delete(cache.keys().next().value);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    const code = error?.name === 'TimeoutError' ? 'MODEL_TIMEOUT'
      : ['MODEL_UNAVAILABLE', 'INVALID_MODEL_RESPONSE'].includes(error?.message) ? error.message : 'LOCAL_MODEL_UNAVAILABLE';
    return Response.json({ status: 'unavailable', code }, { status: 503, headers: NO_STORE });
  } finally {
    pending.delete(key);
  }
}
