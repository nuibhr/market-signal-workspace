import { randomUUID } from 'node:crypto';
import { storage, operation } from '../storage/database.mjs';
import { resolveSwingCosts, thaiResearchCosts, drResearchCosts } from '../analysis/swing-standard.mjs';
import { ACTIVE_SIGNAL_STATES, SIGNAL_RULE, candidateViews, signalId, summarizeSignals, referenceMark } from './model.mjs';
import { signalUniverse } from './data.mjs';
import {buildDecisionBrief} from './decision-brief.mjs';
import {discoveryIntervalMs,ACTIVE_MONITOR_INTERVAL_MS} from './cadence.mjs';
import {scanAgeMinutes,sharedDaily,sharedCached} from '../market-data/shared-policy.mjs';
const json = row => ({ ...JSON.parse(row.payload_json), revision:row.revision });
const fault = code => Object.assign(new Error(code), { code });
export function defaultSignalCosts(asset) { return asset.id === 'thai' ? thaiResearchCosts(asset.sectionId?.startsWith('MAI')?'small':'large') : asset.id === 'dr' ? drResearchCosts() : null; }
export async function saveUsCosts(memberId, input) {
  const fields = ['commissionPercent','marketFeePercent','commissionVatPercent','slippagePercent'];
  const costs = Object.fromEntries(fields.map(key=>[key,input[key]])); resolveSwingCosts(costs);
  const id = signalId(JSON.stringify(costs)), at = new Date().toISOString();
  await storage.batch([
    operation('INSERT OR IGNORE INTO signal_desk_profiles VALUES(?,?,?)',id,JSON.stringify(costs),at),
    operation(`INSERT INTO signal_desk_preferences VALUES(?,?) ON CONFLICT(member_id) DO UPDATE SET us_profile=excluded.us_profile`,memberId,id),
    operation('INSERT OR IGNORE INTO signal_desk_profile_access VALUES(?,?)',memberId,id),
  ]);
  return { id, costs };
}
export async function usCostProfile(memberId) {
  const row = await storage.first(`SELECT p.id,p.costs_json FROM signal_desk_preferences s JOIN signal_desk_profiles p ON p.id=s.us_profile WHERE s.member_id=?`,memberId);
  return row ? { id:row.id, costs:JSON.parse(row.costs_json) } : null;
}
export async function allCostProfiles() {
  return (await storage.all('SELECT DISTINCT p.id,p.costs_json FROM signal_desk_profiles p JOIN signal_desk_preferences s ON s.us_profile=p.id')).map(p=>({id:p.id,costs:JSON.parse(p.costs_json)}));
}
export async function claimSignalLease(market, now, duration = 120000) {
  const token = randomUUID();
  const row = await storage.first(`INSERT INTO signal_desk_leases VALUES(?,?,?,?) ON CONFLICT(market) DO UPDATE SET token=excluded.token,until_ms=excluded.until_ms,heartbeat_ms=excluded.heartbeat_ms WHERE signal_desk_leases.until_ms<=? RETURNING token`,market,token,now+duration,now,now);
  return row?.token === token ? token : null;
}
export async function releaseSignalLease(market, token, now = Date.now()) { await storage.run('UPDATE signal_desk_leases SET until_ms=0,heartbeat_ms=? WHERE market=? AND token=?',now,market,token); }
export async function saveObservation(snapshot, nextMs) {
  await storage.run(`INSERT INTO signal_desk_observations VALUES(?,?,?,?,?) ON CONFLICT(market,symbol) DO UPDATE SET payload_json=excluded.payload_json,checked_ms=excluded.checked_ms,next_scan_ms=excluded.next_scan_ms WHERE excluded.checked_ms>=signal_desk_observations.checked_ms`,snapshot.market,snapshot.symbol,JSON.stringify(snapshot),Date.parse(snapshot.checkedAt),nextMs);
}
export async function observationSchedule(market) { return storage.all('SELECT symbol,next_scan_ms FROM signal_desk_observations WHERE market=?',market); }
export async function storedObservation(market,symbol) {
  const row=await storage.first('SELECT payload_json FROM signal_desk_observations WHERE market=? AND symbol=?',market,symbol);
  return row?JSON.parse(row.payload_json):null;
}
export async function activeReferenceSignals(market) { return (await storage.all("SELECT * FROM signal_desk_signals WHERE market=? AND status IN ('WAITING','OPEN','RUNNER') ORDER BY updated_at,id",market)).map(json); }
export async function insertReferenceSignal(signal) {
  const token = randomUUID(), event = { type:'PICK_READY',createdAt:signal.publishedAt,price:signal.plan.entry,detail:'แผน Swing เผยแพร่แล้ว รอแท่งยืนยันหลังเวลานี้',barTime:signal.context.latest4hTime };
  const results=await storage.batch([
    operation(`INSERT OR IGNORE INTO signal_desk_signals VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,signal.id,signal.market,signal.symbol,signal.mode,signal.profile,SIGNAL_RULE,signal.status,signal.publishedAt,signal.updatedAt,JSON.stringify(signal),0,token),
    operation(`INSERT OR IGNORE INTO signal_desk_events(id,signal_id,market,symbol,type,created_at,payload_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signal_desk_signals WHERE id=? AND last_operation=?)`,signalId(`${signal.id}:PICK_READY`),signal.id,signal.market,signal.symbol,event.type,event.createdAt,JSON.stringify(event),signal.id,token),
  ]);
  return (results[0].changes||0)>0;
}
export async function saveReferenceAdvance(previous, signal, events) {
  const token = randomUUID();
  const queries = [operation(`UPDATE signal_desk_signals SET status=?,updated_at=?,payload_json=?,revision=revision+1,last_operation=? WHERE id=? AND revision=?`,signal.status,signal.updatedAt,JSON.stringify(signal),token,signal.id,previous.revision)];
  for (let i=0;i<events.length;i++) {
    const e=events[i], id=signalId(`${signal.id}:${previous.revision+1}:${i}:${e.type}`);
    queries.push(operation(`INSERT OR IGNORE INTO signal_desk_events(id,signal_id,market,symbol,type,created_at,payload_json) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signal_desk_signals WHERE id=? AND last_operation=?)`,id,signal.id,signal.market,signal.symbol,e.type,e.createdAt,JSON.stringify(e),signal.id,token));
  }
  await storage.batch(queries);
}
export async function signalDeskFeed(memberId, { market='thai',page=1,query='',mode='all',favorites=null,after=null,recordId=null } = {}) {
  const profile = await usCostProfile(memberId), profileId = market==='us'?profile?.id??'unconfigured':'standard';
  const universe = signalUniverse(market), known=new Set(universe.map(a=>a.symbol));
  const snapshots = await sharedCached(`signal-observations:${market}`,async()=>(await storage.all('SELECT * FROM signal_desk_observations WHERE market=?',market)).map(r=>JSON.parse(r.payload_json)).filter(r=>known.has(r.symbol)));
  const maximumScanAgeMinutes=scanAgeMinutes(market);
  const bySymbol = new Map(snapshots.map(s=>[s.symbol,Date.now()-Date.parse(s.checkedAt)>maximumScanAgeMinutes*60000?{...s,status:'UNAVAILABLE',code:'SCAN_STALE'}:s]));
  const requested = universe.filter(a=>(!query||`${a.symbol} ${a.name}`.toLowerCase().includes(query.toLowerCase()))&&(!favorites||favorites.includes(a.symbol)));
  const rows = requested.flatMap(asset => candidateViews(bySymbol.get(asset.symbol) || { market, symbol:asset.symbol,name:asset.name,status:'UNAVAILABLE',code:'NOT_SCANNED_YET' },market==='us'?profile?.costs:defaultSignalCosts(asset))).filter(row=>mode==='all'||row.mode===mode);
  rows.sort((a,b)=>({PASS:0,WAIT:1,REJECT:2,UNAVAILABLE:3}[a.state]-{PASS:0,WAIT:1,REJECT:2,UNAVAILABLE:3}[b.state])||a.symbol.localeCompare(b.symbol));
  const currentPage=Math.max(1,Math.min(Math.ceil(rows.length/7)||1,Math.floor(Number(page)||1)));
  const allowedProfiles=market==='us'?(await storage.all('SELECT profile_id FROM signal_desk_profile_access WHERE member_id=?',memberId)).map(p=>p.profile_id):['standard'];
  const records=(await storage.all('SELECT * FROM signal_desk_signals WHERE market=? AND cost_profile IN (SELECT value FROM json_each(?)) AND rule_version=? ORDER BY published_at DESC,id',market,JSON.stringify(allowedProfiles),SIGNAL_RULE)).map(json);
  const relevant=records.filter(s=>(mode==='all'||s.mode===mode)&&(!favorites||favorites.includes(s.symbol))&&(!query||s.symbol.toLowerCase().includes(query.toLowerCase())));
  const cursor = after === null ? null : Number(after);
  if(cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<0))throw fault('INVALID_EVENT_CURSOR');
  const high=(await storage.first('SELECT COALESCE(MAX(seq),0) AS seq FROM signal_desk_events')).seq;
  const eventRows=cursor===null?[]:await storage.all(`SELECT e.*,s.mode AS mode FROM signal_desk_events e JOIN signal_desk_signals s ON s.id=e.signal_id WHERE e.seq>? AND e.market=? AND s.cost_profile IN (SELECT value FROM json_each(?)) AND s.rule_version=? ORDER BY e.seq LIMIT 100`,cursor,market,JSON.stringify(allowedProfiles),SIGNAL_RULE);
  const record=recordId?records.find(s=>s.id===recordId)??null:null;
  const recordEvents=record?await storage.all('SELECT * FROM signal_desk_events WHERE signal_id=? ORDER BY seq',record.id):[];
  const projectEvent=(r,m)=>({...JSON.parse(r.payload_json),id:r.id,seq:r.seq,signalId:r.signal_id,ledger:'swing',side:'LONG',symbol:r.symbol,market:r.market,mode:m});
  return { status:'available',dataMode:sharedDaily()?'daily-snapshot':'continuous',ruleVersion:SIGNAL_RULE,notificationScope:`swing:${memberId}:${market}`,market,usCosts:profile,
    decisionBrief:buildDecisionBrief(rows),
    cadence:{discoveryMinutes:discoveryIntervalMs(market)/60000,monitorMinutes:ACTIVE_MONITOR_INTERVAL_MS/60000,queuedWakeMinutes:5},
    costs:market==='us'?profile?.costs:defaultSignalCosts({id:market}), scannedAt:new Date().toISOString(),
    rows:rows.slice((currentPage-1)*7,currentPage*7),page:currentPage,pageSize:7,totalRows:rows.length,
    coverage:{expected:universe.length,observed:snapshots.length,maximumScanAgeMinutes,available:[...bySymbol.values()].filter(s=>s.status==='AVAILABLE').length,
      unavailable:[...bySymbol.values()].filter(s=>s.status!=='AVAILABLE').length,neverChecked:universe.length-snapshots.length,
      lastCheckedAt:snapshots.map(s=>s.checkedAt).sort().at(-1)??null},
    worker:await storage.first('SELECT heartbeat_ms AS heartbeatMs,until_ms AS busyUntil,? AS idleAfterMs FROM signal_desk_leases WHERE market=?',process.env.AUTO_PICK_RUNTIME==='cloudflare'?420000:180000,market),
    signals:relevant.filter(s=>ACTIVE_SIGNAL_STATES.includes(s.status)).map(s=>({...s,...referenceMark(s)})),history:relevant.filter(s=>!ACTIVE_SIGNAL_STATES.includes(s.status)).slice(0,100),
    statistics:summarizeSignals(relevant.filter(s=>s.profile===profileId)),statisticsByMode:Object.fromEntries(['breakout','pullback'].map(m=>[m,summarizeSignals(relevant.filter(s=>s.mode===m&&s.profile===profileId))])),
    record,recordEvents:recordEvents.map(r=>projectEvent(r,record.mode)),
    recordStatistics:record?summarizeSignals(records.filter(s=>s.mode===record.mode&&s.profile===record.profile)):null,
    events:eventRows.map(r=>projectEvent(r,r.mode)),
    nextCursor:eventRows.length===100?eventRows.at(-1).seq:Math.max(high,eventRows.at(-1)?.seq||0),
    note:'ผลสัญญาณอ้างอิง ไม่ใช่พอร์ตหรือราคา fill ของลูกค้า · ข้อมูลปิดดีเลย์อย่างน้อย 15 นาที' };
}
