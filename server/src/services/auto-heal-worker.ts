import { getDb } from '../db/index.js';
import { sanitizeProviderErrorMessage } from '../lib/error-redaction.js';

/**
 * Passive error diagnostic worker.
 *
 * Polls the `requests` table every 60s for new provider errors and logs them
 * with contextual diagnostics. Never mutates the codebase, never forks a child
 * process, never applies patches — monitoring only. (#ongoing)
 *
 * Rationale: the previous implementation copied the entire project to a sandbox,
 * sent the source to an LLM via loopback, parsed the LLM's output with regex,
 * ran `git apply` in the sandbox, ran tests, and if they passed, applied the
 * same LLM-generated patch to the production codebase. That pipeline introduced
 * multiple web-app-breaking risks (file corruption from regex parsing, LLM
 * hallucination directly to production files, disk exhaustion from sandbox
 * copies) for zero proven upside in a single-user self-hosted proxy. (#238)
 *
 * If you need automated healing, use an external agent that reads the log and
 * proposes PRs — don't let the server mutate itself.
 */

let lastCheckedId = 0;
let workerHandle: ReturnType<typeof setInterval> | undefined;

export function startAutoHealWorker() {
  console.log('[AutoHeal] Passive diagnostic worker started.');

  // Initialize lastCheckedId to the max request ID so we only observe new errors
  const db = getDb();
  try {
    const maxRow = db.prepare('SELECT MAX(id) as maxId FROM requests').get() as { maxId: number | null };
    lastCheckedId = maxRow.maxId ?? 0;
  } catch (err) {
    console.error('[AutoHeal] Failed to initialize lastCheckedId:', err);
  }

  // Poll database every 60 seconds
  workerHandle = setInterval(async () => {
    try {
      await pollAndLog();
    } catch (err) {
      console.error('[AutoHeal] Worker poll error:', err);
    }
  }, 60_000);
}

export function stopAutoHealWorker() {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = undefined;
  }
}

async function pollAndLog() {
  const db = getDb();
  const errors = db.prepare(`
    SELECT id, platform, model_id, error, created_at
    FROM requests
    WHERE id > ? AND status = 'error' AND error IS NOT NULL
    ORDER BY id ASC
  `).all(lastCheckedId) as Array<{ id: number; platform: string; model_id: string; error: string; created_at: string }>;

  if (errors.length === 0) return;

  lastCheckedId = Math.max(...errors.map(e => e.id));

  for (const err of errors) {
    const safe = sanitizeProviderErrorMessage(err.error);
    console.log(`[AutoHeal] Diagnostic | id=${err.id} platform=${err.platform} model=${err.model_id} error="${safe}"`);
  }
}
