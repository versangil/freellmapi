# AGENTS.md — Code Mode

This file provides coding guidance when making changes in this repository.

## Coding Rules (Non-Obvious, Discovered by Reading)

- **All server imports must use `.js` extensions** — ESM requires it (`import { createApp } from './app.js'`). Use `.js` even when the actual file is `.ts`.
- **Shared types** imported as `@freellmapi/shared/types.js` (with `.js` extension).
- **Client uses `@/` alias** for `./src/*` imports.
- **No vitest config file exists** — all config is via CLI flags in `server/package.json`. When adding new test config, use CLI flags, not a config file.
- **`contentToString()`** in [`server/src/lib/content.ts`](server/src/lib/content.ts) handles all message content normalization. Always use it instead of direct `typeof content === 'string'` checks — content can be string, null, or array of blocks.
- **New providers** must be registered in both `providers/index.ts` AND have their `Platform` type added in `shared/types.ts`. See the extensive comments in `providers/index.ts` for historical removals with reasons.
- **`keyless: true`** providers (Kilo, Pollinations, LLM7) need a sentinel DB entry — no real API key to store.
- **Custom providers** get `timeoutMs: 120000` automatically via `resolveProvider()`.
- **DB is SQLite via better-sqlite3** — no connection pooling, no ORM for migrations (raw SQL in `migrations.ts`). Drizzle ORM is only used for schema/query building where already adopted.
- **WAL mode** is enabled for persistent DBs (`db.pragma('journal_mode = WAL')`). In-memory DBs skip this.

## Test Writing

- Test files use `initDb(':memory:')` for isolated DB per test suite.
- Helper `mintDashboardToken()` creates a session for gated `/api/*` routes.
- Each test creates its own Express server: `const server = app.listen(0)` — random port.

## Ponytail — Lazy Senior Dev Mode

This mode enforces the ponytail philosophy via MCP. Invoke with `/ponytail lite|full|ultra` or `"stop ponytail"` to deactivate.

### The Ladder (stop at the first rung that holds)

1. **Does this need to exist at all?** YAGNI — skip it, say so in one line.
2. **Stdlib does it?** Use it.
3. **Native platform feature covers it?** HTML/CSS/DB constraint over JS/libs.
4. **Already-installed dependency solves it?** Use it. Never add one for what a few lines can do.
5. **Can it be one line?** One line.
6. **Only then:** minimum code that works.

### Rules

- No unrequested abstractions (interface with one impl, factory for one product).
- No boilerplate, no scaffolding "for later".
- Deletion over addition. Boring over clever. Fewest files possible.
- Mark deliberate simplifications with `ponytail:` comment naming the ceiling + upgrade path.
- Complex request? Ship lazy version + question it in the same response.

### When NOT to be lazy

Input validation at trust boundaries, error handling preventing data loss, security, accessibility, anything explicitly requested. Non-trivial logic leaves ONE runnable check (assert/demo/one small test file).
