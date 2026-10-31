import { storage } from '../../../../storage/database.mjs';
import { currentMember, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin } from '../../../../membership/store.mjs';
import { readJsonBody, requestErrorResponse } from '../../../../security/request-guard.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request) {
  let member = null;
  try {
    member = await currentMember();
  } catch {
    member = null;
  }
  if (!member || !isAdmin(member)) {
    return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const brokerId = url.searchParams.get('brokerId');
  const status = url.searchParams.get('status');
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  let sql = 'SELECT * FROM partner_account_leads WHERE 1=1';
  const params = [];
  if (brokerId) {
    sql += ' AND broker_id = ?';
    params.push(brokerId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  try {
    const leads = await storage.all(sql, ...params);
    const summary = await storage.first(`
      SELECT
        COUNT(*) as totalLeads,
        COALESCE(SUM(status = 'new'), 0) as newLeads,
        COALESCE(SUM(status = 'contacted'), 0) as contactedLeads,
        COALESCE(SUM(status = 'account_opened'), 0) as openedLeads,
        COALESCE(SUM(broker_id = '003'), 0) as piLeads,
        COALESCE(SUM(broker_id = '022'), 0) as trinityLeads
      FROM partner_account_leads
    `);

    return Response.json({ success: true, leads, summary }, { headers: NO_STORE });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request) {
  let member = null;
  try {
    member = await currentMember();
  } catch {
    member = null;
  }
  if (!member || !isAdmin(member)) {
    return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  if (!sameOrigin(request)) {
    return Response.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403, headers: NO_STORE });
  }

  let body;
  try {
    body = await readJsonBody(request, 8192);
  } catch (e) {
    return requestErrorResponse(e);
  }

  const { id, status, notes } = body || {};
  if (!id) {
    return Response.json({ success: false, error: 'ID_REQUIRED' }, { status: 400, headers: NO_STORE });
  }

  const validStatuses = ['new', 'contacted', 'in_progress', 'account_opened', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return Response.json({ success: false, error: 'INVALID_STATUS' }, { status: 400, headers: NO_STORE });
  }

  const now = new Date().toISOString();
  try {
    let updateSql = 'UPDATE partner_account_leads SET updated_at = ?';
    const params = [now];
    if (status) {
      updateSql += ', status = ?';
      params.push(status);
    }
    if (typeof notes === 'string') {
      updateSql += ', notes = ?';
      params.push(notes.slice(0, 500));
    }
    updateSql += ' WHERE id = ?';
    params.push(id);

    await storage.run(updateSql, ...params);
    return Response.json({ success: true, id, status, updatedAt: now }, { headers: NO_STORE });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers: NO_STORE });
  }
}
