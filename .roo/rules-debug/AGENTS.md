# AGENTS.md — Debug Mode

This file provides debugging guidance specific to this repository.

## Debugging Gotchas (Discovered by Reading)

- **Silent boot failure**: Server exits with `process.exit(1)` on any boot error (bad ENCRYPTION_KEY, missing env vars). There is NO recovery — check the terminal output, not just "server not running".
- **IPv6 fallback**: If server fails to start, it may be an IPv6 issue. Server binds `::` by default. Check if `HOST=0.0.0.0` is needed on your machine. The fallback log message says "IPv6 unavailable on this host" — look for it.
- **Stream truncation**: `readSseStream()` in [`server/src/providers/base.ts`](server/src/providers/base.ts) throws on truncated streams (no `[DONE]` + no `finish_reason`). If clients report "stream ended unexpectedly", it's a provider issue, not a transport bug.
- **Tool-call cross-contamination**: When debugging agent conversation issues, check if model-switching mid-conversation caused inline dialect contamination. [`tool-call-rescue.ts`](server/src/lib/tool-call-rescue.ts) handles this, but the agent harness still sees a DEAD turn if rescue fails.
- **Proxy error redaction**: Upstream provider errors are intentionally stripped by [`sanitizeProviderErrorMessage()`](server/src/lib/error-redaction.ts). To see the real error, add temporary logging around the proxy's catch block.
- **DB location**: Persistent DB is at `server/data/freeapi.db` (WAL mode). Delete this file to reset all state (keys, sessions, settings). The `data/` directory is gitignored.
- **CORS failures**: Only `localhost:5173`, `127.0.0.1:5173`, `[::1]:5173` are allowed by default. If the UI can't reach the API, check `DASHBOARD_ORIGINS` env var.
- **10mb body limit**: If requests fail silently at the HTTP level, check request body size — 10mb limit is high but code agents ship massive prompts.
- **Old playground messages auto-deleted at 30 days** — data you see in the playground may be incomplete.
