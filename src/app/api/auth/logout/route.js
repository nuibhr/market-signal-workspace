import { NextResponse } from 'next/server';
import { deleteSession } from '../../../../membership/store.mjs';
import { sameOrigin, SESSION_COOKIE } from '../../../../membership/server.mjs';

export const runtime = 'nodejs';
export async function POST(request) {
  if (!sameOrigin(request)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
