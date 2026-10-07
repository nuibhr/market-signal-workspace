import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export async function GET() {
  const source = await readFile(
    join(process.cwd(), "src/forex-mt5/connector.mq5"),
    "utf8",
  );
  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="NugaomReadOnlyBridge.mq5"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
