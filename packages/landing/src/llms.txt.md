# test-proxy-recorder

VCR for Playwright — record real HTTP + WebSocket traffic once, replay it deterministically on CI with the backend turned off. No hand-written mocks. Covers Next.js & TanStack Start SSR, browser, and WebSocket traffic. Node >= 20, MIT.

## For AI coding agents — preferred path

This package ships task-focused `SKILL.md` files via [@tanstack/intent](https://www.npmjs.com/package/@tanstack/intent). If your agent supports Intent, load those instead of this file — they are the maintained, deeper source:

```bash
# in the user's project, once
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
# list skills discoverable from installed packages
npx @tanstack/intent@latest list
# load a specific skill into the current context
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
```

Available skills (under `node_modules/test-proxy-recorder/skills/`):

| Skill | Type | When to load |
|---|---|---|
| `proxy-setup` | core | Installing the library, the proxy CLI, `playwright.config.ts` `webServer`, per-test fixtures, record/replay/transparent modes, secret redaction, the config file, and the record-once → commit → CI-replay lifecycle |
| `nextjs-ssr` | framework | Next.js App Router: tagging server-side fetches with `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, the build-and-start vs `next dev` caveat, why the middleware is optional |
| `tanstack-start` | framework | TanStack Start (Vite + Nitro): tagging loaders / server functions / server routes, the build vs `vite dev` caveat, the server-vs-browser API-URL split, TanStack Query SSR prefetch, and the real-auth pattern |

The rest of this file is a condensed reference for agents that cannot load Intent skills.

## Package info

- npm: https://www.npmjs.com/package/test-proxy-recorder
- repo: https://github.com/asmyshlyaev177/test-proxy-recorder
- website: https://test-proxy-recorder.dev
- docs: https://test-proxy-recorder.dev/docs/
- full README: https://raw.githubusercontent.com/asmyshlyaev177/test-proxy-recorder/refs/heads/master/README.md

## What it is

A record/replay HTTP + WebSocket proxy for deterministic end-to-end tests. It sits between the app and the real backend:

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

Record real traffic once, commit the recordings, then replay them byte-for-byte on CI with no backend and no network. Requests are keyed per Playwright test via the `x-test-rcrd-id` session header so parallel tests stay isolated.

## Requirements

- Node.js >= 20
- `@playwright/test` >= 1.0.0 (peer dependency)

## Install & set up

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
# scaffold config, Playwright fixture, teardown, scripts (and, on Next.js,
# registerProxyFetch() in the root layout). Pass YOUR backend base URL as target:
npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings
```

`init` overwrites nothing and prints the app-specific steps it can't guess (chiefly: point the app's API base URL at the proxy in dev/test only).

## Core rules — read first

1. **Point the app's API base URL at the proxy only when the recorder is enabled**, at the real backend otherwise. The proxy never runs in production. Gate on `TEST_PROXY_RECORDER_ENABLED`.
2. **Record against a production build, never a dev server.** Next.js: `next build && next start` (not `next dev`). TanStack Start: `vite build` then `node .output/server/index.mjs` (not `vite dev`). Dev-server module reloading corrupts recordings.
3. **Tag server-side (SSR) fetches.** Browser requests already carry the recording-session id (Playwright sets it); SSR fetches do not until you register the proxy (see below). Browser-only apps (SPA, extension) can skip this.
4. **Commit the `.mock.json` / HAR recordings.** CI replays them with the backend off.
5. **Secrets are redacted by default** — `Authorization`, `Cookie`, `Set-Cookie` headers. Never commit real tokens; tune with `--redact-headers` / `--redact-body` / `--no-redact`.

## Modes

Set the mode in your fixture (or via the control endpoint):

- `record` — proxy to the real backend and persist every exchange.
- `replay` — serve saved responses from disk; no network (CI default).
- `transparent` — pass through to the real backend without recording (e.g. a real login step before recording).

## Package exports

| Import path | Use |
|---|---|
| `test-proxy-recorder` | Core: `ProxyServer` and shared types |
| `test-proxy-recorder/playwright` | `playwrightProxy` fixture (`before(page, testInfo, mode, { url })` / teardown) |
| `test-proxy-recorder/nextjs` | `registerProxyFetch`, `registerProxyAxios`, `createHeadersWithRecordingId`, `setNextProxyHeaders`, `getRecordingId`, `RECORDING_ID_HEADER` |
| `test-proxy-recorder/tanstack-start` | `registerProxyFetch`, `createHeadersWithRecordingId`, `getRecordingId` |

## CLI

```bash
# run the proxy standalone (target = real backend base URL)
test-proxy-recorder <target> --port 8100 --dir ./e2e/recordings

test-proxy-recorder init <target> [--port] [--dir] [--config]   # scaffold into a project
test-proxy-recorder reset                                        # reset proxy mode
```

Flags: `--port`, `--dir`, `--config`, `--no-redact`, `--redact-headers`, `--redact-body`. CLI flags override the config file. Control endpoint: `/__control` (Playwright `webServer` points here; also flips mode at runtime).

## Next.js SSR — tag server-side fetches

Add one line to the root layout so SSR/Server-Component fetches carry the session id. No-op in production unless `TEST_PROXY_RECORDER_ENABLED=true`:

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

Using axios server-side? Call `registerProxyAxios(instance)` instead. `createHeadersWithRecordingId()` is the patch-free per-call option. The `setNextProxyHeaders` middleware is **optional** — it only exposes the id, it does not tag fetches. Full detail: the `nextjs-ssr` skill.

## TanStack Start SSR — tag server-side fetches

```ts
// src/router.tsx — patch global fetch once, at the top
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

Covers route loaders, server functions, and server routes. Split the server `BACKEND_URL` from the browser `import.meta.env.VITE_API_URL`. Full detail: the `tanstack-start` skill.

## Config file (optional)

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'https://api.example.com',
  port: 8100,
  dir: './e2e/recordings',
  // redact: { headers: [...], body: [...] },
});
```

Load with `--config`. CLI flags override config values.

## Common mistakes (fix any agent generating these)

| Mistake | Fix |
|---|---|
| Recording against `next dev` / `vite dev` | Record against a production build (`next build && next start`; `vite build` + `node .output/server/index.mjs`) |
| Pointing the app at the proxy in production | Gate the proxy URL on `TEST_PROXY_RECORDER_ENABLED`; the proxy is dev/test only |
| SSR responses not recorded / cross-test bleed | Call `registerProxyFetch()` (or `registerProxyAxios`) so server fetches carry `x-test-rcrd-id` |
| Assuming the Next.js middleware tags fetches | It does not — it only exposes the id; use `registerProxyFetch` to tag |
| Not committing the recordings | Commit `e2e/recordings/` so CI can replay with the backend off |
| Committing real tokens in recordings | Redaction is on by default; keep it, or extend with `--redact-headers` / `--redact-body` |
| Hand-writing mocks | Record real traffic once instead |

## Documentation resources

- Full documentation as one Markdown file: https://test-proxy-recorder.dev/llms-full.txt
- Quick start: https://test-proxy-recorder.dev/docs/getting-started/quick-start/
- How it works: https://test-proxy-recorder.dev/docs/getting-started/how-it-works/
- CLI: https://test-proxy-recorder.dev/docs/guides/cli/
- Config file: https://test-proxy-recorder.dev/docs/guides/config/
- Secret redaction: https://test-proxy-recorder.dev/docs/guides/secret-redaction/
- Integrations: Playwright, Next.js, TanStack Start — https://test-proxy-recorder.dev/docs/integrations/playwright/
- AI agent skills: https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/
- API reference (generated from TypeScript + JSDoc): https://test-proxy-recorder.dev/docs/reference/api/
