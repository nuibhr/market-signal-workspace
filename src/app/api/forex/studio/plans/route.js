import YahooFinance from "yahoo-finance2";
import { cookies } from "next/headers.js";
import { currentMember } from "../../../../../membership/server.mjs";
import { isAdmin, isConfigured } from "../../../../../membership/store.mjs";
import { detectChartSetup } from "../../../../../components/forex/studio-plan.mjs";
import { studioBroadcaster } from "../broadcaster.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"], versionCheck: false });
const liveCache = new Map();

function yahooSymbolFor(raw = "XAU/USD") {
  const s = String(raw).toUpperCase().replace(/\s+/g, "");
  if (s === "XAU/USD" || s === "XAUUSD") return { ticker: "GC=F", digits: 2, canonical: "XAUUSD", display: "XAU/USD" };
  if (s === "XAG/USD" || s === "XAGUSD") return { ticker: "SI=F", digits: 3, canonical: "XAGUSD", display: "XAG/USD" };
  if (s === "USD/THB" || s === "USDTHB") return { ticker: "THB=X", digits: 2, canonical: "USDTHB", display: "USD/THB" };
  const clean = s.replace("/", "");
  const digits = clean.endsWith("JPY") ? 3 : 5;
  return { ticker: `${clean}=X`, digits, canonical: clean, display: clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : raw };
}

async function fetchLiveForexPayload(symbol = "XAU/USD", timeframe = "1h") {
  const tf = ["15m", "1h", "4h", "1d"].includes(timeframe) ? timeframe : "1h";
  const interval = tf === "4h" ? "1h" : tf;
  const key = `${symbol}:${tf}`;
  const cached = liveCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const info = yahooSymbolFor(symbol);
  const days = interval === "15m" ? 7 : interval === "1h" ? 25 : 180;
  const chart = await yf.chart(info.ticker, {
    period1: new Date(Date.now() - days * 86400000),
    period2: new Date(),
    interval,
  });

  const rawBars = [];
  const seen = new Set();
  for (const q of chart?.quotes ?? []) {
    const t = Math.floor(new Date(q.date).getTime() / 1000);
    if (!Number.isFinite(t) || seen.has(t)) continue;
    if (![q.open, q.high, q.low, q.close].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)) continue;
    seen.add(t);
    rawBars.push({
      time: t,
      open: Number(q.open.toFixed(info.digits)),
      high: Number(q.high.toFixed(info.digits)),
      low: Number(q.low.toFixed(info.digits)),
      close: Number(q.close.toFixed(info.digits)),
      volume: Number.isFinite(q.volume) && q.volume > 0 ? q.volume : 100,
    });
  }
  rawBars.sort((a, b) => a.time - b.time);
  const bars = rawBars.slice(-100);
  const last = bars.at(-1);
  const prev = bars.at(-2) ?? last;
  const price = last?.close ?? null;
  const change = price && prev?.close ? Number(((price - prev.close) / prev.close * 100).toFixed(2)) : 0;

  let setup = null;
  if (bars.length >= 25) {
    setup = detectChartSetup(bars, tf === "15m" ? "15m" : "1h");
  }

  const value = {
    symbol: info.display,
    canonical: info.canonical,
    ticker: info.ticker,
    timeframe: tf,
    price,
    change,
    asOf: last ? new Date(last.time * 1000).toISOString() : new Date().toISOString(),
    bars,
    setup,
  };
  liveCache.set(key, { value, expires: Date.now() + 60000 });
  return value;
}

// Educational live coach practice plan.
let activeCoachPlan = {
  id: "coach-xauusd-live",
  title: "แผนวิเคราะห์สดโค้ชน้องนักออม (XAU/USD)",
  side: "buy",
  entry: "2651.50",
  stop: "2646.00",
  target: "2662.50",
  balance: "1000",
  riskPercent: "1",
  unitsPerLot: "100",
  condition: "หากแท่ง 1H หลุดแนวรับโครงสร้าง ให้ยกเลิกแผนทันที รอย่อซื้อใหม่ที่แนวรับถัดไป",
  coach: "น้องนักออม AI & ทีมงานวิจัย",
  updatedAt: new Date().toISOString(),
  source: "ห้องฝึกสด Forex Live Studio (ข้อมูลจำลอง)",
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request = null) {
  if (request?.url) {
    try {
      const url = new URL(request.url);
      if (url.searchParams.get("candles") === "1") {
        const symbol = url.searchParams.get("symbol") || "XAU/USD";
        const timeframe = url.searchParams.get("timeframe") || "1h";
        const live = await fetchLiveForexPayload(symbol, timeframe);
        let tickerQuotes = {};
        if (url.searchParams.get("tickers") === "1") {
          const pairs = ["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "USD/CAD", "XAG/USD"];
          const settled = await Promise.allSettled(pairs.map((p) => fetchLiveForexPayload(p, "1h")));
          for (const item of settled) {
            if (item.status === "fulfilled" && item.value?.price) {
              const v = item.value;
              tickerQuotes[v.canonical] = {
                symbol: v.display,
                canonical_symbol: v.canonical,
                price: v.price,
                bid: v.price,
                ask: v.price,
                change: v.change,
                as_of: v.asOf,
                source: "Yahoo Finance Live",
              };
            }
          }
        }
        const livePlan = live.setup
          ? {
              ...activeCoachPlan,
              title: `แผนวิเคราะห์สดโค้ชน้องนักออม (${live.symbol} · ${timeframe.toUpperCase()})`,
              side: live.setup.side,
              entry: String(live.setup.entry),
              stop: String(live.setup.stop),
              target: String(live.setup.target),
              condition: live.setup.condition,
              updatedAt: live.asOf,
              source: `Yahoo Finance (${live.ticker}) · ราคาจริงล่าสุด`,
            }
          : activeCoachPlan;
        if (live.canonical === "XAUUSD" && live.setup) {
          activeCoachPlan = livePlan;
        }
        return Response.json(
          {
            status: "ok",
            mode: "live_market",
            symbol: live.symbol,
            timeframe: live.timeframe,
            price: live.price,
            change: live.change,
            asOf: live.asOf,
            bars: live.bars,
            quotes: tickerQuotes,
            plan: livePlan,
            syncedAt: new Date().toISOString(),
          },
          { headers: NO_CACHE_HEADERS },
        );
      }
    } catch {}
  }
  return Response.json(
    {
      status: "ok",
      mode: "educational_demo",
      plan: activeCoachPlan,
      syncedAt: new Date().toISOString(),
    },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function POST(request) {
  try {
    let cookieStore = null;
    try {
      cookieStore = await cookies();
    } catch {}
    const viewer = isConfigured() && cookieStore ? await currentMember({ cookieStore }) : null;
    const authorized = !isConfigured() || isAdmin(viewer);

    if (!authorized) {
      return Response.json(
        { error: "UNAUTHORIZED", message: "เฉพาะเจ้าของห้องหรือผู้ดูแลระบบที่สามารถ Publish แผนได้" },
        { status: 403, headers: NO_CACHE_HEADERS },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return Response.json({ error: "INVALID_BODY" }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    activeCoachPlan = {
      ...activeCoachPlan,
      ...body,
      id: "coach-xauusd-live",
      coach: viewer?.displayName || body.coach || "โค้ชน้องนักออม",
      updatedAt: new Date().toISOString(),
    };

    try {
      studioBroadcaster.emit("coach_plan", activeCoachPlan);
    } catch {}

    return Response.json(
      { status: "ok", plan: activeCoachPlan, message: "อัปเดตและถ่ายทอดแผนสู่สมาชิกเรียบร้อยแล้ว" },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error) {
    return Response.json({ error: "SERVER_ERROR", message: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
