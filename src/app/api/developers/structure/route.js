import { analyzeMarketStructure } from '../../../../developers/structure.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
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
    return Response.json(
      {
        status: 'error',
        code: 'INVALID_JSON',
        message: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง หรือไม่พบ array ของ candles',
      },
      { status: 400 }
    );
  }
}
