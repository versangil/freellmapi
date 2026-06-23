import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'data/freeapi.db');
const db = new Database(dbPath);

const total = db.prepare('SELECT COUNT(*) as count FROM models').get();
const enabled = db.prepare('SELECT COUNT(*) as count FROM models WHERE enabled=1').get();
const fallbackTotal = db.prepare('SELECT COUNT(*) as count FROM fallback_config').get();
const withKeys = db.prepare(`SELECT COUNT(DISTINCT m.id) as count FROM models m
  JOIN fallback_config fc ON fc.model_db_id = m.id
  JOIN api_keys ak ON ak.platform = m.platform
  WHERE ak.enabled = 1`).get();

console.log({
  total: total.count,
  enabled: enabled.count,
  fallbackTotal: fallbackTotal.count,
  withKeys: withKeys.count,
});

const byPlatform = db.prepare(`SELECT m.platform, COUNT(DISTINCT m.id) as count FROM models m
  JOIN api_keys ak ON ak.platform = m.platform
  WHERE ak.enabled = 1
  GROUP BY m.platform`).all();
console.log('By platform (with keys):', byPlatform);

db.close();