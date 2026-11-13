import { storage } from '../../../../storage/database.mjs';
import { currentMember, sameOrigin } from '../../../../membership/server.mjs';
import { isAdmin, getBrokerStaffRole } from '../../../../membership/store.mjs';
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
  const role = getBrokerStaffRole(member);
  if (!role) {
    return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const reqBrokerId = url.searchParams.get('brokerId');
  const leadType = url.searchParams.get('leadType');
  const status = url.searchParams.get('status');
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));

  // If officer for a specific broker, forcibly lock to their brokerId!
  const targetBrokerId = role.isSuper ? reqBrokerId : role.brokerId;

  let sql = 'SELECT * FROM partner_account_leads WHERE 1=1';
  const params = [];
  if (targetBrokerId) {
    sql += ' AND broker_id = ?';
    params.push(targetBrokerId);
  }
  if (leadType && ['new_account', 'existing_port'].includes(leadType)) {
    sql += ' AND lead_type = ?';
    params.push(leadType);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  try {
    const leads = await storage.all(sql, ...params);

    // Summary scope: if broker admin, count only their own leads!
    const summaryFilter = role.isSuper ? '' : `WHERE broker_id = '${role.brokerId}'`;
    const summary = await storage.first(`
      SELECT
        COUNT(*) as totalLeads,
        COALESCE(SUM(status = 'new'), 0) as newLeads,
        COALESCE(SUM(status = 'contacted'), 0) as contactedLeads,
        COALESCE(SUM(status = 'account_opened'), 0) as openedLeads,
        COALESCE(SUM(broker_id = '003'), 0) as piLeads,
        COALESCE(SUM(broker_id = '022'), 0) as trinityLeads,
        COALESCE(SUM(broker_id = '050'), 0) as aslLeads,
        COALESCE(SUM(lead_type = 'existing_port'), 0) as existingPortLeads,
        COALESCE(SUM(lead_type = 'new_account'), 0) as newAccountLeads
      FROM partner_account_leads
      ${summaryFilter}
    `);

    return Response.json({ success: true, leads, summary, brokerRole: role }, { headers: NO_STORE });
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
  const role = getBrokerStaffRole(member);
  if (!role) {
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

  try {
    // If broker admin, ensure lead belongs to their broker!
    if (!role.isSuper) {
      const existing = await storage.first('SELECT broker_id FROM partner_account_leads WHERE id = ?', id);
      if (!existing || existing.broker_id !== role.brokerId) {
        return Response.json({ success: false, error: 'FORBIDDEN_BROKER_MISMATCH', message: 'ท่านสามารถจัดการได้เฉพาะลูกค้าของโบรกเกอร์ท่านเท่านั้น' }, { status: 403, headers: NO_STORE });
      }
    }

    const now = new Date().toISOString();
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

