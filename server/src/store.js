// Storage: a single SQLite file (server/centrix.db) using Node's built-in
// SQLite driver – no extra service, account or domain needed.
//
// The app works on an in-memory copy (fast, simple code) and `save()` writes
// it back in one transaction. Each record is a row (collection, id, JSON), so
// moving to Postgres/Supabase later only means replacing this file.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const DB_PATH = process.env.DB_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'centrix.db');
const COLLECTIONS = ['properties', 'units', 'contacts', 'contracts', 'partners', 'slots', 'cases', 'jobs', 'consents', 'documents', 'messages', 'events'];

const sql = new DatabaseSync(DB_PATH);
sql.exec(`
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);
`);

let db = load();

function load() {
  const settings = sql.prepare('SELECT data FROM meta WHERE key = ?').get('settings');
  if (!settings) {
    const seed = buildSeed();
    write(seed);
    return seed;
  }
  const out = { settings: JSON.parse(settings.data) };
  for (const c of COLLECTIONS) out[c] = [];
  // rowid keeps insertion order, which the timeline and chat rely on
  for (const row of sql.prepare('SELECT collection, data FROM records ORDER BY rowid').all()) {
    out[row.collection]?.push(JSON.parse(row.data));
  }
  return out;
}

function write(data) {
  const insert = sql.prepare('INSERT INTO records (collection, id, data) VALUES (?, ?, ?)');
  sql.exec('BEGIN');
  try {
    sql.exec('DELETE FROM records');
    for (const c of COLLECTIONS) for (const item of data[c] ?? []) insert.run(c, item.id, JSON.stringify(item));
    sql.prepare('INSERT OR REPLACE INTO meta (key, data) VALUES (?, ?)').run('settings', JSON.stringify(data.settings));
    sql.exec('COMMIT');
  } catch (err) {
    sql.exec('ROLLBACK');
    throw err;
  }
}

export function getDb() {
  return db;
}

export function save() {
  write(db);
}

export function reset() {
  db = buildSeed();
  write(db);
  return db;
}

let counter = 0;
export function id(prefix) {
  counter = (counter + 1) % 1000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export const now = () => new Date().toISOString();
