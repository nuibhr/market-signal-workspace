import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export async function GET(request) {
  const format = new URL(request.url).searchParams.get("format");
  const compiled = format === "ex5", relay = format === "relay";
  try {
    const content = await readFile(join(process.cwd(), "src/forex-mt5",
      relay ? "customer-relay.zip" : compiled ? "connector.ex5" : "connector.mq5"));
    return new Response(content, { headers: {
      "Content-Type": relay ? "application/zip" : compiled ? "application/octet-stream" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${relay ? "NugaomCustomerRelay.zip" : `NugaomReadOnlyBridge.${compiled ? "ex5" : "mq5"}`}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "CONNECTOR_UNAVAILABLE" }, { status: 503,
      headers: { "Cache-Control": "no-store" } });
  }
}
