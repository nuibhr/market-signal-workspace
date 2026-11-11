import { HfInference } from '@huggingface/inference';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THAI_CHAR_REGEX = /[\u0E00-\u0E7F]/;
const MAX_TEXT_LENGTH = 600;
const MAX_CACHE_SIZE = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const audioCache = new Map();
const pendingJobs = new Map();

function getCached(key) {
  const item = audioCache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    audioCache.delete(key);
    return null;
  }
  return item;
}

function setCache(key, buffer, contentType, engine) {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const oldest = [...audioCache.keys()].slice(0, 50);
    for (const k of oldest) audioCache.delete(k);
  }
  audioCache.set(key, {
    buffer,
    contentType,
    engine,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Hugging Face MMS-TTS Thai (facebook/mms-tts-tha)
async function synthesizeHf(text) {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
  if (!token) throw new Error('HF_TOKEN_NOT_CONFIGURED');
  const hf = new HfInference(token);
  const blob = await hf.textToSpeech({
    model: 'facebook/mms-tts-tha',
    inputs: text,
  });
  const arrayBuffer = await blob.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: blob.type || 'audio/flac',
    engine: 'hf-mms-tha',
  };
}

// Free Cloud Neural Thai TTS
async function synthesizeCloud(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`FREE_TTS_HTTP_${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: 'audio/mpeg',
    engine: 'cloud-neural-tha',
  };
}

async function generateSpeech(text, { engine = 'auto' } = {}) {
  const cacheKey = `${engine}:${text}`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  if (pendingJobs.has(cacheKey)) {
    return pendingJobs.get(cacheKey);
  }

  const job = (async () => {
    let result = null;
    const hasHfToken = Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
    const preferHf = engine === 'hf' || (hasHfToken && engine !== 'cloud');

    if (preferHf) {
      try {
        result = await synthesizeHf(text);
      } catch (err) {
        if (engine === 'hf' && !hasHfToken) throw err;
        // Fallback to cloud neural TTS
        result = await synthesizeCloud(text);
      }
    } else {
      try {
        result = await synthesizeCloud(text);
      } catch (err) {
        if (hasHfToken) {
          result = await synthesizeHf(text);
        } else {
          throw err;
        }
      }
    }

    setCache(cacheKey, result.buffer, result.contentType, result.engine);
    return { ...result, fromCache: false };
  })().finally(() => {
    pendingJobs.delete(cacheKey);
  });

  pendingJobs.set(cacheKey, job);
  return job;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawText = searchParams.get('text') || searchParams.get('t') || '';
    const text = rawText.trim();
    const engine = searchParams.get('engine') || 'auto';

    if (!text) {
      return Response.json({ error: 'TEXT_REQUIRED', message: 'กรุณาระบุข้อความ' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: 'TEXT_TOO_LONG', message: 'ข้อความยาวเกินกำหนด (สูงสุด 600 อักษร)' }, { status: 400 });
    }

    if (!THAI_CHAR_REGEX.test(text)) {
      return Response.json({ error: 'THAI_TEXT_REQUIRED', message: 'รองรับเฉพาะเสียงภาษาไทยเท่านั้น' }, { status: 400 });
    }

    const { buffer, contentType, engine: usedEngine, fromCache } = await generateSpeech(text, { engine });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-TTS-Engine': usedEngine,
        'X-TTS-Cache': fromCache ? 'HIT' : 'MISS',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'TTS_SYNTHESIS_FAILED',
        message: error?.message || 'ไม่สามารถแปลงข้อความเป็นเสียงได้',
      },
      { status: 503 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawText = body.text || '';
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    const engine = body.engine || 'auto';

    if (!text) {
      return Response.json({ error: 'TEXT_REQUIRED', message: 'กรุณาระบุข้อความ' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json({ error: 'TEXT_TOO_LONG', message: 'ข้อความยาวเกินกำหนด' }, { status: 400 });
    }

    if (!THAI_CHAR_REGEX.test(text)) {
      return Response.json({ error: 'THAI_TEXT_REQUIRED', message: 'รองรับเฉพาะเสียงภาษาไทยเท่านั้น' }, { status: 400 });
    }

    const { buffer, contentType, engine: usedEngine, fromCache } = await generateSpeech(text, { engine });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-TTS-Engine': usedEngine,
        'X-TTS-Cache': fromCache ? 'HIT' : 'MISS',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'TTS_SYNTHESIS_FAILED',
        message: error?.message || 'ไม่สามารถแปลงข้อความเป็นเสียงได้',
      },
      { status: 503 }
    );
  }
}
