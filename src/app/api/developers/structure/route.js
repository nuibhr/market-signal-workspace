import { analyzeMarketStructure } from '../../../../developers/structure.mjs';

import {readJsonBody,requestErrorResponse} from '../../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await readJsonBody(request,128000,{allowArray:true});
    const candles = Array.isArray(body) ? body : (body.candles || body.bars || []);
    const result = analyzeMarketStructure(candles);
    const statusCode = result.status === 'success' ? 200 : 400;

    return Response.json(result, {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (err) {
    return requestErrorResponse(err);
  }
}
