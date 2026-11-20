// Tiny JSON-file store. Everything lives in memory and is flushed to db.json
// after each write, so the demo survives a server restart.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db.json');

let db = load();

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    const seed = buildSeed();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
}

export function getDb() {
  return db;
}

export function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function reset() {
  db = buildSeed();
  save();
  return db;
}

let counter = 0;
export function id(prefix) {
  counter = (counter + 1) % 1000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export const now = () => new Date().toISOString();
