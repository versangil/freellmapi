/**
 * Auto-heal diagnostic entry point.
 *
 * Previously: forked by auto-heal-worker.ts, copied the codebase to a sandbox,
 * sent source to an LLM via loopback, applied LLM-generated patches to
 * production via git apply. All of that has been removed — see auto-heal-worker.ts
 * for reasoning. This script now serves as a no-op entry point that logs
 * diagnostic info if ever invoked directly.
 *
 * If invoked directly (e.g. `node auto-heal.js --error "..."`), it prints a
 * helpful message pointing to the passive diagnostic worker.
 */

const args = process.argv.slice(2);
const errorMessage = args.includes('--error') ? args[args.indexOf('--error') + 1] : '';

if (errorMessage) {
  console.log(`[AutoHeal Agent] Direct invocation with error: "${errorMessage}"`);
  console.log('[AutoHeal Agent] The auto-healing agent has been converted to passive diagnostics.');
  console.log('[AutoHeal Agent] Check the server logs — the background worker records errors every 60s.');
} else {
  console.log('[AutoHeal Agent] This script is a no-op. The passive diagnostic worker runs in the main process.');
  console.log('[AutoHeal Agent] See server/src/services/auto-heal-worker.ts for details.');
}

process.exit(0);
