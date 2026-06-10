import { getDb } from '../db/index.js';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let lastCheckedId = 0;
let isHealing = false;

// Keeps track of error signatures we are already trying to heal
const healingSignatures = new Set<string>();

export function startAutoHealWorker() {
  console.log('[AutoHeal] Background worker started.');

  // Initialize lastCheckedId to the max request ID so we only heal new errors
  const db = getDb();
  try {
    const maxRow = db.prepare('SELECT MAX(id) as maxId FROM requests').get() as { maxId: number | null };
    lastCheckedId = maxRow.maxId ?? 0;
  } catch (err) {
    console.error('[AutoHeal] Failed to initialize lastCheckedId:', err);
  }

  // Poll database every 30 seconds
  setInterval(async () => {
    if (isHealing) return;
    try {
      await pollAndHeal();
    } catch (err) {
      console.error('[AutoHeal] Worker poll error:', err);
    }
  }, 30000);
}

async function pollAndHeal() {
  const db = getDb();
  // Fetch new errors since last checked ID
  const errors = db.prepare(`
    SELECT id, platform, model_id, error, created_at
    FROM requests
    WHERE id > ? AND status = 'error' AND error IS NOT NULL
    ORDER BY id ASC
  `).all(lastCheckedId) as Array<{ id: number; platform: string; model_id: string; error: string; created_at: string }>;

  if (errors.length === 0) return;

  // Update last checked ID
  lastCheckedId = Math.max(...errors.map(e => e.id));

  for (const err of errors) {
    const signature = `${err.platform}:${err.model_id}:${err.error.slice(0, 100)}`;
    if (healingSignatures.has(signature)) continue;

    // We detect if this error or signature is suitable for healing
    // Reject common authentication/network/decryption errors (which are environmental, not code bugs)
    const normalizedErr = err.error.toLowerCase();
    if (
      normalizedErr.includes('api key') ||
      normalizedErr.includes('unauthorized') ||
      normalizedErr.includes('forbidden') ||
      normalizedErr.includes('quota') ||
      normalizedErr.includes('rate limit') ||
      normalizedErr.includes('timeout') ||
      normalizedErr.includes('etimedout') ||
      normalizedErr.includes('econnrefused')
    ) {
      continue;
    }

    console.log(`[AutoHeal] Detected repairable error: "${err.error}" on ${err.platform}/${err.model_id}. Launching agent...`);
    healingSignatures.add(signature);
    isHealing = true;

    // Spawn the sandboxed auto-healing script in a separate process
    const scriptPath = path.resolve(__dirname, '../scripts/auto-heal.js');
    
    // Ensure scripts dir exists
    const scriptsDir = path.dirname(scriptPath);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const child = fork(scriptPath, [
      '--error', err.error,
      '--platform', err.platform,
      '--model', err.model_id
    ], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    child.on('exit', (code) => {
      isHealing = false;
      console.log(`[AutoHeal] Healing process exited with code ${code}`);
    });

    // Run one healing process at a time to prevent resource exhaustion
    break;
  }
}
