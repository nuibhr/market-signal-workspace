import { cookies } from "next/headers.js";
import { currentMember } from "../../../../../membership/server.mjs";
import { isAdmin, isConfigured } from "../../../../../membership/store.mjs";
import { studioBroadcaster } from "../broadcaster.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  condition: "หากแท่ง 1H หลุด 2646 ให้ยกเลิกแผนทันที รอย่อซื้อใหม่ที่แนวรับถัดไป",
  coach: "น้องนักออม AI & ทีมงานวิจัย",
  updatedAt: new Date().toISOString(),
  source: "ห้องฝึกสด Forex Live Studio (ข้อมูลจำลอง)",
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
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
