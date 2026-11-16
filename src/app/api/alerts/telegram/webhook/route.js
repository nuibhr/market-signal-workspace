import { createHash, timingSafeEqual } from 'node:crypto';
import { readJsonBody, requestErrorResponse } from '../../../../../security/request-guard.mjs';
import { handleTelegramWebhookUpdate } from '../../../../../notifications/vip-access.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function validTelegramSecret(provided, expected) {
  if (typeof provided !== 'string' || !expected || typeof expected !== 'string') return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const provided = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (!validTelegramSecret(provided, secret)) {
      return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: NO_STORE });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  }

  let update;
  try {
    update = await readJsonBody(request, 65536);
  } catch (err) {
    return requestErrorResponse(err);
  }

  try {
    const result = await handleTelegramWebhookUpdate(update);
    return Response.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (err) {
    console.error('[Telegram Webhook] Failed:', err?.message);
    return Response.json({ ok: false, error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500, headers: NO_STORE });
  }
}

