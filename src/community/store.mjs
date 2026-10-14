import { createHash } from 'node:crypto';
import { storage, operation as op } from '../storage/database.mjs';
import { isAdmin } from '../membership/store.mjs';
import { membershipFor } from '../membership/rights.mjs';
import { RequestError } from '../security/request-guard.mjs';
const fail=(code,status=400)=>{throw new RequestError(code,status);};
const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validMemberId=value=>typeof value==='string'&&/^[-_a-zA-Z0-9]{16,100}$/.test(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pageNumber=value=>Math.max(1,Math.min(1000000,Math.floor(Number(value)||1)));
function text(value,max) {
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value))fail('INVALID_COMMUNITY_INPUT');
  const result=value.trim().replace(/\b\d(?:[ -]?\d){4,23}\b/g,digits=>'••••'+digits.replace(/[ -]/g,'').slice(-4));
  if(!result)fail('INVALID_COMMUNITY_INPUT');return result;
}
export async function communityAccess(actor) {
  if(!actor)fail('LOGIN_REQUIRED',401);
  const member=await storage.first('SELECT * FROM members WHERE id=?',actor.id);
  if(!member)fail('LOGIN_REQUIRED',401);
  const admin=isAdmin(member);
  const roles=(await storage.all('SELECT role FROM community_staff WHERE member_id=?',member.id)).map(row=>row.role);
  return {member,admin,roles,rooms:admin||roles.length>0||membershipFor(member).capabilities.communityPosting};
}
function requireRoom(access){if(!access.rooms)fail('MEMBERSHIP_REQUIRED',403);}
async function roomAccess(access,id){requireRoom(access);const room=await storage.first('SELECT * FROM community_rooms WHERE id=?',id);if(!room)fail('CHANNEL_NOT_FOUND',404);return room;}
function teamAccess(access,team){return access.admin||access.roles.includes(team);}
async function threadAccess(access,id){
  if(!validId(id))fail('CHANNEL_NOT_FOUND',404);
  const thread=await storage.first('SELECT * FROM support_threads WHERE id=?',id);
  if(!thread||thread.member_id!==access.member.id&&!teamAccess(access,thread.team))fail('CHANNEL_NOT_FOUND',404);
  return thread;
}
function safeThread(row){return {id:row.id,team:row.team,subject:row.subject,status:row.status,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,...(row.memberName?{memberName:row.memberName}:{})};}
const readKey=(kind,id)=>`${kind}:${id}`;
const recipientGate=()=>`(t.member_id=? OR ?=1 OR EXISTS(SELECT 1 FROM community_staff WHERE member_id=? AND role=t.team))`;
const roomGate=`(?=1 OR EXISTS(SELECT 1 FROM community_staff WHERE member_id=?) OR EXISTS(SELECT 1 FROM members WHERE id=? AND (subscription_ends_at>? OR (trial_ends_at>? AND portfolio_status<>'missing'))))`;

export async function communityOverview(actor,{team=false,page=1}={}) {
  const a=await communityAccess(actor);
  if(team&&!a.admin&&!a.roles.length)fail('FORBIDDEN',403);
  const rooms=a.rooms?await storage.all(`SELECT r.id,r.name,r.description,r.locked,
    COALESCE((SELECT MAX(seq) FROM community_messages WHERE room_id=r.id),0) AS lastSeq,
    (SELECT COUNT(*) FROM community_messages m WHERE m.room_id=r.id AND m.hidden=0 AND m.sender_id<>? AND m.seq>COALESCE((SELECT last_seq FROM community_reads WHERE member_id=? AND channel='room:'||r.id),0)) AS unread
    FROM community_rooms r ORDER BY CASE r.id WHEN 'lounge' THEN 0 ELSE 1 END,r.id`,a.member.id,a.member.id):[];
  const where=team?(a.admin?'1=1':`EXISTS(SELECT 1 FROM community_staff s WHERE s.member_id=? AND s.role=t.team)`):'t.member_id=?';
  const args=team&&a.admin?[]:[a.member.id];
  const incomingCursor=(await storage.first(`SELECT COALESCE(MAX(x.seq),0) AS n FROM community_messages x
    WHERE x.hidden=0 AND x.sender_id<>? AND ((x.room_id IS NOT NULL AND ?=1)
      OR (x.thread_id IS NOT NULL AND EXISTS(SELECT 1 FROM support_threads t WHERE t.id=x.thread_id AND ${where})))`,a.member.id,Number(a.rooms&&!team),...args)).n;
  const total=(await storage.first(`SELECT COUNT(*) AS n FROM support_threads t WHERE ${where}`,...args)).n;
  const current=Math.min(pageNumber(page),Math.ceil(total/7)||1);
  const threads=await storage.all(`SELECT t.*,m.display_name AS memberName,
    COALESCE((SELECT MAX(seq) FROM community_messages WHERE thread_id=t.id),0) AS lastSeq,
    (SELECT COUNT(*) FROM community_messages x WHERE x.thread_id=t.id AND x.hidden=0 AND x.sender_id<>? AND x.seq>COALESCE((SELECT last_seq FROM community_reads WHERE member_id=? AND channel='thread:'||t.id),0)) AS unread
    FROM support_threads t JOIN members m ON m.id=t.member_id WHERE ${where} ORDER BY t.updated_at DESC,t.id DESC LIMIT 7 OFFSET ?`,a.member.id,a.member.id,...args,(current-1)*7);
  return {access:{rooms:a.rooms,admin:a.admin,roles:a.roles,team:a.admin||a.roles.length>0},incomingCursor,rooms:rooms.map(r=>({...r,locked:!!r.locked})),threads:threads.map(r=>({...safeThread(r),lastSeq:r.lastSeq,unread:r.unread})),total,page:current,pageSize:7};
}
export async function channelMessages(actor,{kind,id,page=1}) {
  const a=await communityAccess(actor);
  const channel=kind==='room'?await roomAccess(a,id):kind==='thread'?await threadAccess(a,id):fail('INVALID_CHANNEL');
  const column=kind==='room'?'room_id':'thread_id';
  const total=(await storage.first(`SELECT COUNT(*) AS n FROM community_messages WHERE ${column}=?`,id)).n;
  const current=Math.min(pageNumber(page),Math.ceil(total/7)||1);
  const rows=await storage.all(`SELECT x.id,x.seq,x.body,x.hidden,x.created_at,x.sender_kind,x.sender_id,m.display_name FROM community_messages x JOIN members m ON m.id=x.sender_id WHERE x.${column}=? ORDER BY x.seq DESC LIMIT 7 OFFSET ?`,id,(current-1)*7);
  // Recheck rights before returning a private inbox if a transfer/revocation raced the read.
  if(kind==='thread')await threadAccess(await communityAccess(actor),id);
  else requireRoom(await communityAccess(actor));
  return {channel:kind==='room'?{id:channel.id,name:channel.name,locked:!!channel.locked}:safeThread(channel),messages:rows.map(r=>({id:r.id,seq:r.seq,body:r.hidden?null:r.body,hidden:!!r.hidden,createdAt:r.created_at,author:r.hidden?'ข้อความถูกซ่อน':r.display_name,fromTeam:r.sender_kind==='team',own:r.sender_id===a.member.id})),total,page:current,pageSize:7,canManage:kind==='thread'&&teamAccess(a,channel.team),admin:a.admin};
}
async function replay(a,id,payloadHash){const previous=await storage.first('SELECT actor_id,payload_hash,result_json FROM community_operations WHERE id=?',id);if(!previous)return null;if(previous.actor_id!==a.member.id||previous.payload_hash!==payloadHash)fail('OPERATION_CONFLICT',409);return {...JSON.parse(previous.result_json),replayed:true};}
function operationRecord(a,body,digest,result,gate,params,normalized) {
  const details=Object.fromEntries(Object.entries(normalized).filter(([key])=>!['body','subject','reason','action'].includes(key)));
  return op(`INSERT INTO community_operations(id,actor_id,action,payload_hash,result_json,details_json,created_at) SELECT ?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO NOTHING`,body.operationId,a.member.id,body.action,digest,JSON.stringify(result),JSON.stringify(details),new Date().toISOString(),...params);
}
export async function mutateCommunity(actor,body) {
  const a=await communityAccess(actor),actorId=a.member.id;
  if(!validId(body.operationId))fail('INVALID_REQUEST_ID');
  const now=new Date().toISOString();
  let normalized,channel,message,result,queries=[];
  if(body.action==='create-thread') {
    if(!['marketing','analyst'].includes(body.team))fail('INVALID_TEAM');
    normalized={action:body.action,team:body.team,subject:text(body.subject,100),body:text(body.body,2000)};
    result={ok:true,threadId:body.operationId};
  } else if(body.action==='send'||body.action==='read') {
    if(!['room','thread'].includes(body.kind)||typeof body.channelId!=='string')fail('INVALID_CHANNEL');
    channel=body.kind==='room'?await roomAccess(a,body.channelId):await threadAccess(a,body.channelId);
    if(body.action==='send') {
      normalized={action:body.action,kind:body.kind,channelId:body.channelId,body:text(body.body,2000)};
      result={ok:true,messageId:body.operationId};
    } else {
      if(!Number.isSafeInteger(body.lastSeq)||body.lastSeq<0)fail('INVALID_CURSOR');
      const max=(await storage.first(`SELECT COALESCE(MAX(seq),0) AS n FROM community_messages WHERE ${body.kind==='room'?'room_id':'thread_id'}=?`,body.channelId)).n;
      if(body.lastSeq>max)fail('INVALID_CURSOR');
      normalized={action:body.action,kind:body.kind,channelId:body.channelId,lastSeq:body.lastSeq};result={ok:true};
    }
  } else if(body.action==='report'||body.action==='moderate') {
    if(!validId(body.messageId))fail('MESSAGE_NOT_FOUND',404);
    message=await storage.first('SELECT id,room_id,thread_id FROM community_messages WHERE id=?',body.messageId);
    if(!message)fail('MESSAGE_NOT_FOUND',404);
    if(body.action==='report') {
      if(message.room_id)await roomAccess(a,message.room_id);else await threadAccess(a,message.thread_id);
      normalized={action:body.action,messageId:body.messageId,reason:text(body.reason,300)};result={ok:true};
    } else {
      if(!a.admin)fail('FORBIDDEN',403);
      if(typeof body.hidden!=='boolean')fail('INVALID_COMMUNITY_INPUT');
      normalized={action:body.action,messageId:body.messageId,hidden:body.hidden};result={ok:true};
    }
  } else if(body.action==='thread-state'||body.action==='transfer') {
    channel=await threadAccess(a,body.threadId);
    if(!teamAccess(a,channel.team))fail('FORBIDDEN',403);
    if(!Number.isSafeInteger(body.version)||body.version<0)fail('INVALID_VERSION');
    if(body.action==='thread-state') {
      if(!['review','answered','closed','pending'].includes(body.status))fail('INVALID_STATUS');
      normalized={action:body.action,threadId:body.threadId,version:body.version,status:body.status};
    } else {
      if(!['marketing','analyst'].includes(body.team))fail('INVALID_TEAM');
      normalized={action:body.action,threadId:body.threadId,version:body.version,team:body.team};
    }
    result={ok:true};
  } else if(body.action==='role') {
    if(!a.admin)fail('FORBIDDEN',403);
    if(!validMemberId(body.memberId)||!['marketing','analyst'].includes(body.role)||typeof body.enabled!=='boolean')fail('INVALID_COMMUNITY_INPUT');
    if(!await storage.first('SELECT id FROM members WHERE id=?',body.memberId))fail('MEMBER_NOT_FOUND',404);
    normalized={action:body.action,memberId:body.memberId,role:body.role,enabled:body.enabled};result={ok:true};
  } else if(body.action==='lock-room') {
    if(!a.admin)fail('FORBIDDEN',403);
    channel=await roomAccess(a,body.roomId);
    if(typeof body.locked!=='boolean')fail('INVALID_COMMUNITY_INPUT');
    normalized={action:body.action,roomId:body.roomId,locked:body.locked};result={ok:true};
  } else if(body.action==='resolve-report') {
    if(!a.admin)fail('FORBIDDEN',403);
    if(!validId(body.reportId)||!await storage.first('SELECT id FROM community_reports WHERE id=?',body.reportId))fail('REPORT_NOT_FOUND',404);
    normalized={action:body.action,reportId:body.reportId};result={ok:true};
  } else fail('INVALID_ACTION');
  const digest=hash(normalized),previous=await replay(a,body.operationId,digest);if(previous)return previous;
  // Current rights were checked above. Lock/closure blocks new writes, while
  // already committed operations remain confirmable after a lost response.
  if(body.action==='send') {
    if(body.kind==='room'&&channel.locked&&!a.admin)fail('ROOM_LOCKED',409);
    if(body.kind==='thread'&&channel.status==='closed')fail('THREAD_CLOSED',409);
  }
  const record=(gate='1=1',params=[])=>operationRecord(a,body,digest,result,gate,params,normalized);
  const absent='NOT EXISTS(SELECT 1 FROM community_operations WHERE id=?)';
  if(body.action==='create-thread') {
    queries=[op(`INSERT INTO support_threads(id,member_id,team,subject,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${absent} ON CONFLICT(id) DO NOTHING`,body.operationId,actorId,normalized.team,normalized.subject,now,now,body.operationId),
      op(`INSERT INTO community_messages(id,thread_id,sender_id,sender_kind,body,created_at) SELECT ?,id,?,'member',?,? FROM support_threads WHERE id=? AND member_id=? AND ${absent} ON CONFLICT(id) DO NOTHING`,body.operationId,actorId,normalized.body,now,body.operationId,actorId,body.operationId),
      record('EXISTS(SELECT 1 FROM support_threads WHERE id=? AND member_id=?)',[body.operationId,actorId])];
  } else if(body.action==='send') {
    if(body.kind==='thread') {
      queries.push(op(`INSERT INTO community_messages(id,thread_id,sender_id,sender_kind,body,created_at) SELECT ?,t.id,?,CASE WHEN t.member_id=? THEN 'member' ELSE 'team' END,?,? FROM support_threads t WHERE t.id=? AND t.status<>'closed' AND ${recipientGate()} AND ${absent} ON CONFLICT(id) DO NOTHING`,body.operationId,actorId,actorId,normalized.body,now,channel.id,actorId,Number(a.admin),actorId,body.operationId));
    } else {
      queries.push(op(`INSERT INTO community_messages(id,room_id,sender_id,sender_kind,body,created_at) SELECT ?,r.id,?,?,?,? FROM community_rooms r WHERE r.id=? AND (r.locked=0 OR ?=1) AND ${roomGate} AND ${absent} ON CONFLICT(id) DO NOTHING`,body.operationId,actorId,a.admin||a.roles.length?'team':'member',normalized.body,now,channel.id,Number(a.admin),Number(a.admin),actorId,actorId,now,now,body.operationId));
    }
    queries.push(record('EXISTS(SELECT 1 FROM community_messages WHERE id=? AND sender_id=?)',[body.operationId,actorId]));
  } else {
    // All operations in a batch commit together, including the idempotency/audit record.
    if(body.action==='read') queries.push(op(`INSERT INTO community_reads(member_id,channel,last_seq) SELECT ?,?,? WHERE ${absent} ON CONFLICT(member_id,channel) DO UPDATE SET last_seq=MAX(last_seq,excluded.last_seq)`,actorId,readKey(body.kind,channel.id),normalized.lastSeq,body.operationId));
    if(body.action==='report') queries.push(op(`INSERT INTO community_reports(id,message_id,reporter_id,reason,created_at) SELECT ?,?,?,?,? WHERE ${absent} ON CONFLICT(message_id,reporter_id) DO NOTHING`,body.operationId,message.id,actorId,normalized.reason,now,body.operationId));
    if(body.action==='moderate') queries.push(op(`UPDATE community_messages SET hidden=? WHERE id=? AND ${absent}`,Number(normalized.hidden),message.id,body.operationId));
    if(body.action==='role') queries.push(normalized.enabled?op(`INSERT INTO community_staff(member_id,role) SELECT ?,? WHERE ${absent} ON CONFLICT DO NOTHING`,normalized.memberId,normalized.role,body.operationId):op(`DELETE FROM community_staff WHERE member_id=? AND role=? AND ${absent}`,normalized.memberId,normalized.role,body.operationId));
    if(body.action==='lock-room') queries.push(op(`UPDATE community_rooms SET locked=? WHERE id=? AND ${absent}`,Number(normalized.locked),channel.id,body.operationId));
    if(body.action==='resolve-report') queries.push(op(`UPDATE community_reports SET status='resolved' WHERE id=? AND ${absent}`,normalized.reportId,body.operationId));
    if(body.action==='thread-state'||body.action==='transfer') {
      const key=body.action==='transfer'?'team':'status';
      // Record first with the current version and permissions as a transactional guard.
      queries.push(record(`EXISTS(SELECT 1 FROM support_threads t WHERE t.id=? AND t.version=? AND (?=1 OR EXISTS(SELECT 1 FROM community_staff s WHERE s.member_id=? AND s.role=t.team)))`,[channel.id,normalized.version,Number(a.admin),actorId]));
      queries.push(op(`UPDATE support_threads SET ${key}=?,version=version+1,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM community_operations WHERE id=? AND actor_id=? AND payload_hash=?)`,normalized[key],now,channel.id,normalized.version,body.operationId,actorId,digest));
    } else queries.push(record());
  }
  await storage.batch(queries);
  const saved=await replay(a,body.operationId,digest);if(!saved)fail('COMMUNITY_CHANGED',409);return saved;
}
export async function communityAdmin(actor,{page=1}={}) {
  const a=await communityAccess(actor);if(!a.admin)fail('FORBIDDEN',403);
  const total=(await storage.first("SELECT COUNT(*) AS n FROM community_reports WHERE status='open'")).n;
  const current=Math.min(pageNumber(page),Math.ceil(total/7)||1);
  const reports=await storage.all(`SELECT r.id,r.message_id AS messageId,r.reason,r.created_at AS createdAt,x.body,x.hidden,x.room_id AS roomId,x.thread_id AS threadId,m.display_name AS reporter FROM community_reports r JOIN community_messages x ON x.id=r.message_id JOIN members m ON m.id=r.reporter_id WHERE r.status='open' ORDER BY r.created_at,r.id LIMIT 7 OFFSET ?`,(current-1)*7);
  const staff=await storage.all('SELECT s.member_id AS memberId,s.role,m.display_name AS name FROM community_staff s JOIN members m ON m.id=s.member_id ORDER BY m.display_name,s.role');
  return {reports,staff,total,page:current,pageSize:7};
}
