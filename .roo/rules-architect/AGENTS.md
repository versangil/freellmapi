# AGENTS.md — Architect Mode

This file provides architectural context and constraints specific to this repository.

## Architecture (Non-Obvious, Discovered by Reading)

### Request Flow
```
Client → /v1/chat/completions → proxy.ts → routeRequest() → provider.chatCompletion()
                                              ↓ failover fallback chain
    → /v1/responses → responses.ts → /v1/chat/completions → proxy.ts (same flow)
```
- The `/v1/responses` endpoint is an **OpenAI Responses API shim** (for Codex CLI). It translates to `/v1/chat/completions` internally.
- The router uses Thompson sampling for bandit strategies. This is not a simple round-robin.

### Key Architectural Constraints

- **Stateless proxy**: Every request goes through `routeRequest()` which re-evaluates the full fallback chain. There is NO per-request state — only sticky sessions (30-min TTL in-memory map) and rate-limit penalties.
- **SQLite forbids parallelism**: Server vitest must use `--pool=forks --fileParallelism=false`. Never run tests in parallel — SQLite can't handle concurrent writes.
- **Encryption service coupling**: [`initEncryptionKey()`](server/src/lib/crypto.ts) depends on the DB being initialized first. The `setup` endpoint in [`routes/auth.ts`](server/src/routes/auth.ts) must call these in order.
- **Provider adapter registration**: Built-in providers are singletons in a `Map<Platform, BaseProvider>`. Custom providers are constructed per-request with the user's `base_url`.
- **keyless providers**: Not stored in `api_keys` table — need sentinel rows. Routing checks `provider.keyless` to skip key decryption.

### Data Flow Dependencies

- `app.ts` mounts routes in a specific order: auth → API routes (with `requireAuth`) → proxy rate limiter → proxy → responses shim → error handler → static client → SPA fallback.
- `router.ts` → `ratelimit.ts` → `scoring.ts` form the routing pipeline. `scoring.ts` handles weights, Thompson sampling, and decay-weighted analytics.
- Health checker runs every 60s (set interval in `services/health.ts` — no dedicated file read but inferred from `startHealthChecker()` call pattern).

### Hidden Coupling

- **Tool-args repair** in `tool-args.ts` and **tool-call rescue** in `tool-call-rescue.ts` are implicitly coupled through `proxy.ts` — both process assistant output for tool compatibility. Changes to one must consider the other.
- The **fallback chain** (`fallback_config` table) and **models** (`models` table) are tightly coupled via `model_db_id` foreign keys. Models can't exist in the chain without a DB row and vice versa.
- The [`responses.ts`](server/src/routes/responses.ts) shim has an implicit dependency on [`proxy.ts`](server/src/routes/proxy.ts)`s `ensureFallbackChain` and `handleProviderResponse` — it delegates to the same routing machinery.
- [`sticky sessions`](server/src/routes/proxy.ts:61) are in-memory only (no persistence). A server restart clears all sticky affinity.
