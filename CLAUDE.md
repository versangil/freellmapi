# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Install dependencies**: `npm ci` (or `npm install`).
- **Run the server**: `npm run dev` (starts Express server on :3001 and Vite dev server on :5173).
- **Build the frontend**: `npm run build` (produces static assets in `client/dist`).
- **Start production**: `npm start` (serves built client and server).
- **Run tests**: `npm test` (executes Vitest unit tests for server and client).
- **Run a single test**: `npm test -- <test-file-path>` (e.g., `npm test -- server/src/__tests__/routes/playground.test.ts`).
- **Lint**: `npm run lint` (runs ESLint across the repository).
- **Check Docker compose**: `docker compose up -d` (starts the containerized dev environment).
- **Open the dashboard**: navigate to `http://localhost:3001` in a browser.

## Folder Structure Overview

- **/server** – Node/Express backend. Contains routing, provider adapters, services, DB migrations, and entry point (`server/src/app.ts`). Docker configuration lives in the root and mounts this directory.
- **/client** – React/Vite frontend. Source in `client/src`, built output in `client/dist`. The dashboard UI is served from the same Express server.
- **/shared** – Common TypeScript types used by both server and client (`shared/types.ts`).

Key architectural layers:
1. **Router (`server/src/services/router.ts`)** – selects a provider and model based on health, rate limits, and fallback chain.
2. **Provider adapters (`server/src/providers/*.ts`)** – implement OpenAI‑compatible `chatCompletion` and `streamChatCompletion` methods for each external service.
3. **Rate limiting and health services (`server/src/services/ratelimit.ts`, `server/src/services/health.ts`)** – track per‑key usage and probe provider health.
4. **Dashboard** – React components rendered in the browser, communicating with the Express server via the unified API key.
5. **Embeddings** – separate routing logic under `server/src/services/embeddings.ts` that respects model families.

## Commonly Used Files for Quick Context

- `server/src/routes/playground.ts` – definitions for the API playground endpoint used by the UI.
- `client/src/pages/PlaygroundPage.tsx` – React page exposing the playground UI.
- `server/src/services/router.ts` – core routing logic that determines which upstream provider handles a request.
- `client/src/lib/api.ts` – thin wrapper around `fetch` that adds the unified API key and handles streaming.

## Testing & Debugging

- Unit tests are written with Vitest and located under `server/src/__tests__` and `client/src/__tests__`. Run them with `npm test`.
- Integration tests exercise the full request flow (router → provider → response) and are located in `server/src/__tests__/integration`.
- To debug a specific route, modify `server/src/routes/playground.ts` and reload the page at `http://localhost:3001/playground`.

## Docker Development

- **Start container**: `docker compose up -d`.
- **Stop container**: `docker compose down`.
- **Re‑build image**: `docker compose build`.
- **View logs**: `docker compose logs -f`.

## Important Notes

- The project uses an encrypted SQLite database (`better-sqlite3`) for storing API keys. Do not commit raw keys; they are encrypted at rest.
- Provider keys are stored in `.env` and encrypted before persisting. Never expose them in logs or client‑side code.
- When adding new providers, update `server/src/providers/index.ts` and the relevant migration file in `server/src/db/migrations.ts`.