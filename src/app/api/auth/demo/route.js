import { NextResponse } from 'next/server';
import { createSession, upsertDemoMember, deleteSession } from '../../../../membership/store.mjs';
import { SESSION_COOKIE, secureCookie } from '../../../../membership/server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const role = body?.role === 'subscriber' ? 'subscriber' : 'trial';
    const member = await upsertDemoMember({ role });
    const session = await createSession(member.id);

    const response = NextResponse.json({
      ok: true,
      role,
      memberId: member.id,
      displayName: member.display_name,
      broker: member.broker,
      portfolioStatus: member.portfolio_status,
      trialEndsAt: member.trial_ends_at,
      subscriptionEndsAt: member.subscription_ends_at,
    });

    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: secureCookie(request),
      sameSite: 'lax',
      path: '/',
      expires: new Date(session.expiresAt),
    });

    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'DEMO_LOGIN_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}

export async function DELETE(request) {
  try {
    const raw = request.cookies.get(SESSION_COOKIE)?.value;
    if (raw) {
      await deleteSession(raw);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'LOGOUT_FAILED' }, { status: 500 });
  }
}
