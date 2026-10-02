import { sharedDatabase } from '../../../membership/store.mjs';
import { workerProcessHealth } from '../../../auto-pick/store.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    sharedDatabase().prepare('SELECT 1').get();
    const worker = workerProcessHealth();
    return Response.json({ status: 'ok', storage: 'available', scanner: worker.status }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
