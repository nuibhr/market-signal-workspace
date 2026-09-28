import { currentAccount, privateHeaders } from '../../../membership/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await currentAccount(), { headers: privateHeaders });
}
