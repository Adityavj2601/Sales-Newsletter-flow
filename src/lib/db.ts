import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/*
 * SQLite through Node's built-in driver (node:sqlite, Node >= 22.13).
 * Loaded with process.getBuiltinModule so the bundler never tries to resolve it.
 */
type Row = Record<string, any>;
type Stmt = { run: (...a: any[]) => any; get: (...a: any[]) => Row | undefined; all: (...a: any[]) => Row[] };
type DB = { exec: (sql: string) => void; prepare: (sql: string) => Stmt; close: () => void };

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, website TEXT, newsletter_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '{}', sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id) ON DELETE CASCADE, kind TEXT NOT NULL,
  name TEXT NOT NULL, url TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, last_fetched_at TEXT, last_error TEXT,
  last_count INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, source_id TEXT,
  url TEXT NOT NULL, url_hash TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, content TEXT, publisher TEXT,
  published_at TEXT, score INTEGER, score_reason TEXT, status TEXT NOT NULL DEFAULT 'new', used_in TEXT,
  created_at TEXT NOT NULL, UNIQUE(product_id, url_hash)
);
CREATE INDEX IF NOT EXISTS stories_pick ON stories(product_id, status, score);
CREATE TABLE IF NOT EXISTS kb_items (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, pillar TEXT NOT NULL,
  status TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', problem TEXT, result TEXT,
  client_name TEXT, client_permission INTEGER NOT NULL DEFAULT 0, approved_numbers TEXT, media_url TEXT, link TEXT,
  active INTEGER NOT NULL DEFAULT 1, times_featured INTEGER NOT NULL DEFAULT 0, last_featured_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, number INTEGER NOT NULL,
  slug TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', content TEXT NOT NULL, checks TEXT, overrides TEXT,
  planned_for TEXT, scheduled_at TEXT, send_config TEXT, sent_at TEXT, approved_by TEXT, approved_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(product_id, slug)
);
CREATE TABLE IF NOT EXISTS edition_versions (
  id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, content TEXT NOT NULL,
  author TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', email TEXT, phone TEXT, company TEXT,
  role TEXT, city TEXT, tags TEXT NOT NULL DEFAULT '', email_consent INTEGER NOT NULL DEFAULT 0,
  wa_consent INTEGER NOT NULL DEFAULT 0, consent_source TEXT, consent_at TEXT, status TEXT NOT NULL DEFAULT 'active',
  frequency TEXT NOT NULL DEFAULT 'weekly', stage TEXT NOT NULL DEFAULT 'new', score INTEGER NOT NULL DEFAULT 0,
  last_engaged_at TEXT, last_intent TEXT, last_intent_at TEXT, notes TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email ON contacts(product_id, email) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS contacts_phone ON contacts(product_id, phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE, channel TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', error TEXT, provider_id TEXT, send_after TEXT, sent_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deliveries_queue ON deliveries(status, send_after);
CREATE INDEX IF NOT EXISTS deliveries_edition ON deliveries(edition_id);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, product_id TEXT, edition_id TEXT, contact_id TEXT, delivery_id TEXT, type TEXT NOT NULL,
  value TEXT, meta TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_edition ON events(edition_id, type);
CREATE INDEX IF NOT EXISTS events_contact ON events(contact_id, created_at);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id) ON DELETE CASCADE, type TEXT NOT NULL, name TEXT NOT NULL,
  cron TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, config TEXT NOT NULL DEFAULT '{}', last_run_at TEXT,
  last_status TEXT, next_run_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY, job_id TEXT, product_id TEXT, type TEXT NOT NULL, trigger TEXT NOT NULL, status TEXT NOT NULL,
  log TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS job_runs_recent ON job_runs(started_at);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, product_id TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link TEXT,
  read_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_usage (
  id TEXT PRIMARY KEY, task TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER,
  output_tokens INTEGER, ok INTEGER NOT NULL, error TEXT, ms INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, to_addr TEXT NOT NULL, subject TEXT NOT NULL, html TEXT NOT NULL, text TEXT,
  headers TEXT, kind TEXT NOT NULL, created_at TEXT NOT NULL
);
`;

declare global {
  // eslint-disable-next-line no-var
  var __snfDb: DB | undefined;
}

function open(): DB {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const mod = (process as any).getBuiltinModule?.('node:sqlite');
  if (!mod) throw new Error('This app needs Node.js 22.13 or newer (built-in SQLite).');
  const db: DB = new mod.DatabaseSync(path.join(DATA_DIR, 'app.db'));
  db.exec(SCHEMA);
  return db;
}

export function db(): DB {
  if (!globalThis.__snfDb) globalThis.__snfDb = open();
  return globalThis.__snfDb;
}

const norm = (args: any[]) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a));
// node:sqlite returns null-prototype rows; spread them into plain objects so React can serialise them.
export const all = <T = Row>(sql: string, ...args: any[]) => db().prepare(sql).all(...norm(args)).map((r) => ({ ...r })) as T[];
export const get = <T = Row>(sql: string, ...args: any[]) => {
  const r = db().prepare(sql).get(...norm(args));
  return (r ? { ...r } : undefined) as T | undefined;
};
export const run = (sql: string, ...args: any[]) => db().prepare(sql).run(...norm(args));

export function tx<T>(fn: () => T): T {
  db().exec('BEGIN');
  try {
    const r = fn();
    db().exec('COMMIT');
    return r;
  } catch (e) {
    db().exec('ROLLBACK');
    throw e;
  }
}

/** Insert a row from an object; keys are column names. */
export function insert(table: string, row: Row) {
  const keys = Object.keys(row);
  run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, ...keys.map((k) => row[k]));
}
/** Update columns of a row by id. */
export function update(table: string, id: string, row: Row) {
  const keys = Object.keys(row);
  if (!keys.length) return;
  run(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => row[k]), id);
}

export const now = () => new Date().toISOString();
export function uid(prefix = ''): string {
  return prefix + crypto.randomBytes(9).toString('base64url');
}
export function token(len = 12): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += abc[b[i] % abc.length];
  return s;
}
export const parse = <T = any>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
