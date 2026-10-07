import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BASE_SCHEMA, D1_SAFETY_SCHEMA, D1_IMPORT_SAFETY } from './schema.mjs';

let database;

function db() {
  if (database) return database;
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_PATH || './data/nugaom.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(path);
  try {
  database.exec(`PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      picture_url TEXT,
      broker TEXT,
      portfolio_hash TEXT UNIQUE,
      portfolio_last4 TEXT,
      portfolio_status TEXT NOT NULL DEFAULT 'missing',
      portfolio_submitted_at TEXT,
      portfolio_verified_at TEXT,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      subscription_ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS line_oauth_flows (
      token_hash TEXT PRIMARY KEY, state TEXT NOT NULL, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS monthly_codes (
      code_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      created_by TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS renewal_requests (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS membership_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id),
      actor_id TEXT REFERENCES members(id),
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_credit_accounts (
      member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0)
    );
    CREATE TABLE IF NOT EXISTS ai_credit_events (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES members(id),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_questions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      conversation_id TEXT,
      question_text TEXT,
      day_key TEXT NOT NULL,
      charge_type TEXT NOT NULL CHECK(charge_type IN ('free','credit')),
      status TEXT NOT NULL CHECK(status IN ('pending','completed')),
      created_at TEXT NOT NULL,
      response_json TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      checkpoint_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_questions_member_day ON ai_questions(member_id,day_key,status);`);
  const questionColumns = new Set(database.prepare('PRAGMA table_info(ai_questions)').all().map(column => column.name));
  if (!questionColumns.has('conversation_id')) database.exec('ALTER TABLE ai_questions ADD COLUMN conversation_id TEXT');
  if (!questionColumns.has('question_text')) database.exec('ALTER TABLE ai_questions ADD COLUMN question_text TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS ai_questions_conversation ON ai_questions(member_id,conversation_id,created_at)');
  database.exec(BASE_SCHEMA);
  database.exec('CREATE TABLE IF NOT EXISTS storage_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)');
  for (const [version,sql] of [[2,D1_SAFETY_SCHEMA],[3,D1_IMPORT_SAFETY]]) {
    if (database.prepare('SELECT version FROM storage_migrations WHERE version=?').get(version)) continue;
    database.exec('BEGIN IMMEDIATE');
    try { database.exec(sql);database.prepare('INSERT INTO storage_migrations VALUES(?,?)').run(version,new Date().toISOString());database.exec('COMMIT'); }
    catch(error){database.exec('ROLLBACK');database.close();database=undefined;throw error;}
  }
  for (const file of [path, `${path}-wal`, `${path}-shm`]) { try { chmodSync(file, 0o600); } catch { /* SQLite sidecars may not exist yet. */ } }
  return database;
  } catch(error) {
    try{database?.close();}catch{/* Initialization may already have closed the connection. */}
    database=undefined;
    throw error;
  }
}

// Shared persistent connection for membership and the signal/event ledger.
export function sqliteDatabase() { return db(); }


export function sharedDatabase() {
  if ((process.env.STORAGE_PROVIDER || 'sqlite') !== 'sqlite') throw new Error('SQLITE_MAINTENANCE_ONLY');
  return sqliteDatabase();
}
