-- Fresh community implementation. Additive; no customer data or credentials.
CREATE TABLE community_rooms (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1))
);
INSERT INTO community_rooms(id,name,description) VALUES
 ('lounge','ห้องนักออม','พูดคุยและแลกเปลี่ยนประสบการณ์'),
 ('thai','หุ้นไทย','แลกเปลี่ยนมุมมองหุ้นไทย'),
 ('dr','DR','สินทรัพย์ต่างประเทศในกระดานไทย'),
 ('us','US และ ETF','หุ้นสหรัฐฯ และ ETF'),
 ('tfex','TFEX','กราฟ สัญญา และการจัดการความเสี่ยง'),
 ('forex','Forex','คู่เงินและบริบทเศรษฐกิจ');
CREATE TABLE community_staff (
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL CHECK(role IN ('marketing','analyst')),
  PRIMARY KEY(member_id,role)
);
CREATE TABLE support_threads (
  id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id),
  team TEXT NOT NULL CHECK(team IN ('marketing','analyst')), subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','answered','closed')),
  version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE community_messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
  room_id TEXT REFERENCES community_rooms(id), thread_id TEXT REFERENCES support_threads(id),
  sender_id TEXT NOT NULL REFERENCES members(id), sender_kind TEXT NOT NULL CHECK(sender_kind IN ('member','team')),
  body TEXT NOT NULL, applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0,1)), hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), created_at TEXT NOT NULL,
  CHECK((room_id IS NOT NULL AND thread_id IS NULL) OR (room_id IS NULL AND thread_id IS NOT NULL))
);
CREATE INDEX community_room_messages ON community_messages(room_id,seq DESC);
CREATE INDEX community_thread_messages ON community_messages(thread_id,seq DESC);
CREATE INDEX support_member_threads ON support_threads(member_id,updated_at DESC,id);
CREATE INDEX support_team_threads ON support_threads(team,updated_at DESC,id);
CREATE TABLE community_reads (
  member_id TEXT NOT NULL REFERENCES members(id), channel TEXT NOT NULL, last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(member_id,channel)
);
CREATE TABLE community_reports (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES community_messages(id),
  reporter_id TEXT NOT NULL REFERENCES members(id), reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')), created_at TEXT NOT NULL,
  UNIQUE(message_id,reporter_id)
);
CREATE TABLE community_operations (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES members(id), action TEXT NOT NULL,
  payload_hash TEXT NOT NULL, result_json TEXT NOT NULL, details_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER support_message_update AFTER INSERT ON community_messages WHEN NEW.thread_id IS NOT NULL AND NEW.applied=0 BEGIN
  UPDATE support_threads SET updated_at=NEW.created_at,version=version+1,
    status=CASE WHEN NEW.sender_kind='team' THEN 'answered' ELSE 'pending' END WHERE id=NEW.thread_id;
  UPDATE community_messages SET applied=1 WHERE id=NEW.id;
END;
CREATE TRIGGER community_message_no_delete BEFORE DELETE ON community_messages BEGIN
  SELECT RAISE(ABORT,'IMMUTABLE_COMMUNITY_MESSAGE');
END;
CREATE TRIGGER community_message_content_no_update BEFORE UPDATE OF id,seq,room_id,thread_id,sender_id,sender_kind,body,created_at ON community_messages BEGIN
  SELECT RAISE(ABORT,'IMMUTABLE_COMMUNITY_MESSAGE');
END;
