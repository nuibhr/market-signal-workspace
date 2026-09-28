const BASE_URL = 'https://api.marketdx.lab.ai/v1/news';
const MARKETS = [{ id: 'thai', country: 'TH', label: 'หุ้นไทย' }, { id: 'us', country: 'US', label: 'หุ้นอเมริกา' }];
const TTL_MS = 15 * 60_000;
const STALE_MS = 24 * 60 * 60_000;
const snapshots = new Map();
const pending = new Map();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

function normalizeArticle(article) {
  if (!article || typeof article !== 'object') return null;
  const url = safeArticleUrl(article.url);
  const title = cleanText(article.title, 300);
  if (!url || !title) return null;
  const publishedAt = article.article_published_at ?? article.published;
  const published = publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null;
  const impact = Number(article.impact_score);
  const rawEntities = Array.isArray(article.entities) ? article.entities : [];
  return {
    id: cleanText(article.cs_job_id ?? article.story_id, 100) || url,
    title, url, publishedAt: published,
    source: cleanText(article.publisher ?? article.source, 80) || 'ไม่ระบุสำนักข่าว',
    brief: cleanText(article.brief_text, 420),
    impactScore: Number.isInteger(impact) && impact >= 1 && impact <= 5 ? impact : null,
    direction: ['pos', 'neg', 'ambiguous'].includes(article.direction) ? article.direction : 'ambiguous',
    newsTypes: Array.isArray(article.news_types) ? article.news_types.filter(value => typeof value === 'string').slice(0, 3) : [],
    duplicateCount: Number.isInteger(article.dup_count) && article.dup_count > 1 ? article.dup_count : null,
    entities: rawEntities.map(entity => cleanText(entity?.ticker ?? entity?.stock, 30)).filter(Boolean).slice(0, 5),
  };
}

async function fetchMarket(market, key) {
  const url = new URL(BASE_URL);
  for (const [field, value] of Object.entries({ country: market.country, entity_type: 'stock', include: 'entities', collapse: 'true', lang: 'th', limit: '4' })) {
    url.searchParams.set(field, value);
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const error = new Error('MARKETDX_REQUEST_FAILED');
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.results)) throw new Error('MARKETDX_INVALID_RESPONSE');
  const receivedAt = new Date().toISOString();
  const snapshot = {
    id: market.id, country: market.country, label: market.label,
    status: 'available', receivedAt,
    articles: payload.results.map(normalizeArticle).filter(Boolean).slice(0, 4),
    expiresAt: Date.now() + TTL_MS,
  };
  snapshots.set(market.id, snapshot);
  return snapshot;
}

function errorCode(error) {
  return error?.status === 402 ? 'CREDITS_EXHAUSTED' : error?.status === 429 ? 'RATE_LIMITED'
    : error?.status === 401 || error?.status === 403 ? 'AUTH_FAILED' : 'SOURCE_UNAVAILABLE';
}

async function marketResult(market, key) {
  const cached = snapshots.get(market.id);
  if (cached?.expiresAt > Date.now()) return cached;
  try {
    if (!pending.has(market.id)) pending.set(market.id, fetchMarket(market, key).finally(() => pending.delete(market.id)));
    return await pending.get(market.id);
  } catch (error) {
    if (cached && Date.now() - Date.parse(cached.receivedAt) < STALE_MS) return { ...cached, status: 'stale', code: errorCode(error) };
    return { id: market.id, country: market.country, label: market.label, status: 'unavailable', code: errorCode(error), articles: [] };
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.MARKETDX_PUBLIC_DISPLAY_RIGHTS_CONFIRMED !== 'true') {
    return Response.json({ status: 'unavailable', code: 'DISPLAY_RIGHTS_UNCONFIRMED', markets: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const key = process.env.MARKETDX_API_KEY?.trim();
  if (!key) return Response.json({ status: 'unconfigured', code: 'MARKETDX_NOT_CONFIGURED', markets: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  const markets = await Promise.all(MARKETS.map(market => marketResult(market, key)));
  const status = markets.every(market => market.status === 'available') ? 'available'
    : markets.some(market => market.status === 'available' || market.status === 'stale') ? 'partial' : 'unavailable';
  return Response.json({ status, source: 'MarketDX', scope: 'listed-stocks-by-country', markets },
    { status: status === 'unavailable' ? 503 : 200, headers: { 'Cache-Control': 'private, no-store' } });
}
