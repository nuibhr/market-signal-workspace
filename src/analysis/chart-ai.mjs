import { SETTRADE_SYMBOLS } from '../markets/catalog.mjs';
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

export function parseSnapshot(input) {
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

export const DEFAULT_CHART_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const system = 'คุณเป็นผู้ช่วยอธิบายข้อมูลเทคนิคหุ้นไทย ตอบภาษาไทยเท่านั้น แต่ละช่องไม่เกิน 200 ตัวอักษร ใช้เฉพาะ snapshot ห้ามแต่งข่าว พื้นฐาน โอกาสชนะ ราคา ตัวเลข หรือแผนใหม่ ห้ามสั่งซื้อขาย อธิบายแนวโน้มและข้อจำกัดของกรอบเวลา อินดิเคเตอร์ และแท่งที่อาจยังไม่ปิด คืน JSON มี summary และ risk ตาม schema';
export async function generateChartAnalysis(snapshot,{ai,env=process.env,fetcher=fetch,timeoutMs=45000,demo=false}={}) {
  const model=ai?(env.AI_ANALYSIS_MODEL||DEFAULT_CHART_MODEL):(env.OLLAMA_MODEL||'qwen3:4b');
  const prompt=`อธิบายแนวโน้มและข้อจำกัดจาก snapshot นี้ โดยไม่สร้างตัวเลขใหม่: ${JSON.stringify(snapshot)}`;
  let narrative,provider;
  if(demo){
    provider='Demo · ข้อมูลตัวอย่าง';
    narrative={summary:'คำอธิบายตัวอย่างสำหรับทดสอบสิทธิสมาชิก เมื่อใช้บัญชี LINE ระบบจะอธิบาย snapshot กราฟด้วย AI จริง',risk:'ตัวอย่างสาธิต ไม่ใช่บทวิเคราะห์ตลาดจริง กรุณาตรวจกรอบเวลาและเวลาของแท่งข้อมูล'};
  }else if(ai?.run){
    let timer;
    try {
      const result=await Promise.race([
        ai.run(model,{messages:[{role:'system',content:system},{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:outputSchema},max_tokens:650,temperature:0}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DOMException('Model timeout','TimeoutError')),timeoutMs);}),
      ]);
      const raw=result?.response;
      let value;try{value=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('INVALID_MODEL_RESPONSE');}
      narrative=validateNarrative(value);provider='Cloudflare Workers AI';
    }finally{clearTimeout(timer);}
  }else{
    if(env.NODE_ENV==='production'||env.STORAGE_PROVIDER==='d1')throw Error('CLOUD_AI_NOT_CONFIGURED');
    const response=await fetcher('http://127.0.0.1:11434/api/generate',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model,stream:false,think:false,format:outputSchema,options:{temperature:0,num_predict:400},system,prompt}),signal:AbortSignal.timeout(timeoutMs),
    });
    if(!response.ok)throw Error('MODEL_UNAVAILABLE');
    const payload=await response.json();let value;
    try{value=JSON.parse(payload.response??'{}');}catch{throw Error('INVALID_MODEL_RESPONSE');}
    narrative=validateNarrative(value);provider='Ollama local';
  }
  if(!narrative)throw Error('INVALID_MODEL_RESPONSE');
  return {status:'available',provider,model:demo?'demo':model,demo,latestDay:snapshot.latestDay,latestTime:snapshot.latestTime,timeframe:snapshot.timeframe,generatedAt:new Date().toISOString(),narrative};
}
