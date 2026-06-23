# AGENTS.md — Ask Mode

This file provides documentation context specific to this repository.

## Documentation & Architecture (Non-Obvious)

- **CLAUDE.md exists and is the primary AI guide** — but it contains mostly obvious information (standard npm commands, basic folder structure). The real gotchas are in the AGENTS.md files.
- **The code IS the documentation for providers** — `providers/index.ts` contains extensive comments documenting why providers were added/removed with exact dates, version numbers, and root causes. Use this as the canonical source.
- **`shared/types.ts` contains critical inline docs** — the `Platform` type has a block comment documenting every platform removal. The `ChatContentBlock` type documents array-of-blocks handling. These are not in any README.
- **"The README is outdated for internal details"** — build commands, port numbers, and high-level architecture are there. But provider quirks, test setup, and encryption details are only discoverable by reading source files.
- **`.env.example` covers all env vars** — but the two most important ones (ENCRYPTION_KEY auto-generation in dev, HOST fallback on IPv6) only surface in source code comments.
- **AgentX.md and Goal.agent.md** are unrelated agent-prompt files (generic senior-dev persona and planning agent). They are NOT specific to this project — ignore them for project-specific questions.
- **`content.ts` serves dual purpose**: [`contentToString()`](server/src/lib/content.ts) normalizes INBOUND content from clients, [`normalizeOutboundContent()`](server/src/lib/content.ts) normalizes OUTBOUND content from providers. Both handle array-content shapes that the OpenAI spec doesn't enforce.
- **Desktop app** (`desktop/`) bundles the server and serves as an alternative UI (Electron). The `desktop/src/server-host.ts` manages embedded server lifecycle.
