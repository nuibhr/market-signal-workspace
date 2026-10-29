import { studioBroadcaster } from "../broadcaster.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeEnqueue = (data) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          isClosed = true;
        }
      };

      // 1. Initial connection acknowledgement
      safeEnqueue(
        `data: ${JSON.stringify({
          type: "connected",
          status: "online",
          serverTime: new Date().toISOString(),
          channel: "forex-studio-live-feed",
          message: "เชื่อมต่อท่อสัญญาณสดห้อง Forex Live Studio สำเร็จ",
        })}\n\n`,
      );

      // 2. Real-time broadcast listeners
      const onCoachPlan = (plan) => {
        safeEnqueue(
          `data: ${JSON.stringify({
            type: "coach_plan",
            plan,
            time: Math.floor(Date.now() / 1000),
          })}\n\n`,
        );
      };

      const onMarketTick = (tick) => {
        safeEnqueue(`data: ${JSON.stringify(tick)}\n\n`);
      };

      studioBroadcaster.on("coach_plan", onCoachPlan);
      studioBroadcaster.on("market_tick", onMarketTick);

      // 3. Periodic fallback heartbeat & simulated tick
      let count = 0;
      const interval = setInterval(() => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }
        count++;
        const delta = Math.sin(count * 0.4) * 0.6 + Math.cos(count * 0.9) * 0.4;
        const tickPrice = Math.round((2651.2 + delta) * 100) / 100;
        const payload = {
          type: "tick",
          symbol: "XAU/USD",
          price: tickPrice,
          time: Math.floor(Date.now() / 1000),
          status: "live_connected",
        };
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      }, 3000);
      interval.unref?.();

      const cleanup = () => {
        isClosed = true;
        clearInterval(interval);
        studioBroadcaster.off("coach_plan", onCoachPlan);
        studioBroadcaster.off("market_tick", onMarketTick);
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

