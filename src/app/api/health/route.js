import { storage } from '../../../storage/database.mjs';
import { workerProcessHealth } from '../../../auto-pick/store.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await storage.first('SELECT 1');
    const worker = (await workerProcessHealth());
    return Response.json({ status: 'ok', storage: 'available', scanner: worker.status }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
