# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Tests (Non-Obvious)

- `npm test` runs server tests **then** client tests sequentially (client has no test script, so `--if-present` makes it a no-op). To run server tests only: `npm run test -w server`.
- Server vitest runs with `--pool=forks --fileParallelism=false` (no parallelism — SQLite can't handle concurrent writes).
- Single test: `npm test -- server/src/__tests__/routes/playground.test.ts` — vitest interprets the path as a file filter.
- Tests use in-memory SQLite (`initDb(':memory:'`) + `mintDashboardToken()` helper from [`server/src/__tests__/helpers/auth.ts`](server/src/__tests__/helpers/auth.ts). Each test creates its own Express server on a random port via `app.listen(0)`.
- There is **no vitest config file** — all config is via CLI flags in `server/package.json`. No client test infrastructure exists.
- The DB file auto-created at `server/data/freeapi.db` and `data/` is gitignored.

## Encryption & Security (Discovered by Reading)

- `ENCRYPTION_KEY`: In dev (`NODE_ENV !== 'production'`) a key is auto-generated & persisted in the DB. **In production it is required** — the placeholder `your-64-char-hex-key-here` is explicitly rejected with a fail-fast error.
- API keys are stored encrypted (AES-256-GCM) and accepted via **both** `Authorization: Bearer` **and** `x-api-key` header (Anthropic-wire clients like Claude Code via CC Switch).
- [`maskKey()`](server/src/lib/crypto.ts:111) shows only first 4 + last 4 chars. Use this in responses/logs instead of raw keys.

## Provider Quirks (Discovered by Reading Code)

- **Kilo**, **Pollinations**, **LLM7** are `keyless: true` — no API key needed. A sentinel row is stored so routing treats them as "configured".
- **NVIDIA NIM** forces `singleToolCall: true` ("This model only supports single tool-calls at once!").
- **Ollama Cloud** has 120s timeout (reasoning models take 30-90s).
- Custom providers get the same 120s extended timeout.
- The [`providers/index.ts`](server/src/providers/index.ts) file documents historical removals (SambaNova, Moonshot, MiniMax, Chutes) with exact reasons.

## Content Handling (Non-Obvious from OpenAPI)

- `contentToString()` in [`server/src/lib/content.ts`](server/src/lib/content.ts) handles string, null, AND array-of-content-blocks. Gemini-lineage agents (Qwen Code, AionUI) send `{ text }` blocks **without** a `type` field — this is accepted. Non-text blocks (images, audio) are silently dropped.
- `normalizeOutboundContent()` coerces array content back to string on the response path — providers like Mistral magistral return array content which breaks string-consuming clients.

## Tool-Call Cross-Contamination (Critical Gotcha)

- [`tool-call-rescue.ts`](server/src/lib/tool-call-rescue.ts) detects 4 inline dialects emitted when model-switching mid-conversation: Kimi/DeepSeek token markers, Llama/Groq `<function=...>` tags, Qwen/Hermes `<tool_call>` XML, and bare JSON fenced as known tools.
- [`tool-args.ts`](server/src/lib/tool-args.ts) repairs double-encoded arguments (some models emit `{"plan": "[{\"step\":...}]"}` instead of `{"plan": [{"step":...}]}`).

## Routing & Proxy (Non-Obvious)

- **`auto` model keyword**: clients can send `"model": "auto"` to let the router decide — identical to omitting `model`.
- **6 routing strategies**: `priority`, `balanced`, `smartest`, `fastest`, `reliable`, `custom`. Bandit strategies use Thompson sampling. Priority mode uses manual order + 429 penalty.
- **Sticky sessions**: by first user message hash OR explicit `X-Session-Id` header. 30-min TTL. Pinned model is tried first but can still fail over if it hits limits.
- **Error redaction**: [`sanitizeProviderErrorMessage()`](server/src/lib/error-redaction.ts) strips upstream provider details before forwarding errors.
- **IPv6 default**: server listens on `::` (dual-stack). Falls back to `0.0.0.0` if IPv6 is disabled. Set `HOST=0.0.0.0` to force IPv4.
- **10mb JSON body limit**: code agents (OpenCode, AionUI, Qwen Code) ship very large prompts + tool schemas.

## Vite Config (Non-Obvious)

- Proxy explicitly forces `127.0.0.1` (not `localhost`) to avoid IPv6 `::1` resolution issues on Windows + Node 17+.
- Env file loaded from parent directory via `envDir: path.resolve(__dirname, '..')`.
- `__SERVER_PORT__` injected as a global define from the env.

## Import Conventions (From Config)

- All server imports use `.js` extensions for ESM (`import './env.js'`, `import { createApp } from './app.js'`).
- Shared types imported as `@freellmapi/shared/types.js` (with `.js` extension).
- Client uses `@/` path alias mapped to `./src/*`.
- TypeScript strict mode enabled everywhere.

## Error & Logging Gotchas

- Server errors on boot exit with `process.exit(1)` — there is no recovery. A missing ENCRYPTION_KEY in production crashes immediately.
- The client API wrapper [`apiFetch()`](client/src/lib/api.ts:18) detects reverse proxy misconfiguration (non-JSON response) with a clear error message.
- Old playground messages are auto-deleted after 30 days via a startup interval.
