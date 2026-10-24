// Wire protocol contains IDs and bound parameters only; no client-supplied SQL.
export const normalizeSql=sql=>sql.replace(/\s+/g,' ').trim();
export const SCANNER_QUERIES=Object.freeze({
  'request.claim': `UPDATE scanner_jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=(SELECT id FROM scanner_jobs WHERE market=? AND json_extract(payload_json,'$.kind')='swing-manual' AND attempts<5 AND created_at>=? AND ((state IN ('pending','retry') AND available_at<=?) OR (state='running' AND lease_until<?)) ORDER BY created_at,id LIMIT 1) RETURNING *`,
  'request.finish': `UPDATE scanner_jobs SET state=?,error_code=?,available_at=?,payload_json=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=? AND json_extract(payload_json,'$.kind')='swing-manual'`,
  'profiles': `SELECT DISTINCT p.id,p.costs_json FROM signal_desk_profiles p JOIN signal_desk_preferences s ON s.us_profile=p.id`,
  'market.claim': `INSERT INTO signal_desk_leases VALUES(?,?,?,?) ON CONFLICT(market) DO UPDATE SET token=excluded.token,until_ms=excluded.until_ms,heartbeat_ms=excluded.heartbeat_ms WHERE signal_desk_leases.until_ms<=? RETURNING token`,
  'market.release': `UPDATE signal_desk_leases SET until_ms=0,heartbeat_ms=? WHERE market=? AND token=?`,
  'observation.save': `INSERT INTO signal_desk_observations VALUES(?,?,?,?,?) ON CONFLICT(market,symbol) DO UPDATE SET payload_json=excluded.payload_json,checked_ms=excluded.checked_ms,next_scan_ms=excluded.next_scan_ms WHERE excluded.checked_ms>=signal_desk_observations.checked_ms`,
  'observation.schedule': `SELECT symbol,next_scan_ms FROM signal_desk_observations WHERE market=?`,
  'observation.get': `SELECT payload_json FROM signal_desk_observations WHERE market=? AND symbol=?`,
  'signals.active': `SELECT * FROM signal_desk_signals WHERE market=? AND status IN ('WAITING','OPEN','RUNNER') ORDER BY updated_at,id`,
  'signals.insert': `INSERT OR IGNORE INTO signal_desk_signals VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
  'events.insert': `INSERT OR IGNORE INTO signal_desk_events(id,signal_id,market,symbol,type,created_at,payload_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signal_desk_signals WHERE id=? AND last_operation=?)`,
  'signals.advance': `UPDATE signal_desk_signals SET status=?,updated_at=?,payload_json=?,revision=revision+1,last_operation=? WHERE id=? AND revision=?`,
  'cache.get': `SELECT payload_json FROM provider_cache WHERE id=? AND expires_at>?`,
  'cache.put': `INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at`,
  'cache.snapshot': `INSERT INTO provider_cache VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at WHERE json_extract(excluded.payload_json,'$.dataAsOfMs') >= json_extract(provider_cache.payload_json,'$.dataAsOfMs')`,
});
const bySql=new Map(Object.entries(SCANNER_QUERIES).map(([id,sql])=>[normalizeSql(sql),id]));
export function encodeScannerQuery({sql,params=[]}){
  const id=bySql.get(normalizeSql(sql));
  if(!id)throw Error('SCANNER_QUERY_NOT_ALLOWED');
  return {id,params};
}
export function decodeScannerQuery({id,params}={}){
  const sql=Object.hasOwn(SCANNER_QUERIES,id??'')?SCANNER_QUERIES[id]:null;
  if(!sql||!Array.isArray(params)||params.length!==(sql.match(/\?/g)??[]).length||params.some(v=>v!==null&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v))))throw Error('INVALID_SCANNER_QUERY');
  // Scanner caches contain public market context/candles only.
  if(id.startsWith('cache.')&&!/^(thai-stage2-(benchmark-v2|profile:[A-Z0-9-]{1,20})|chart-snapshot-v1:)/.test(params[0]))throw Error('INVALID_SCANNER_CACHE');
  return {sql,params};
}
