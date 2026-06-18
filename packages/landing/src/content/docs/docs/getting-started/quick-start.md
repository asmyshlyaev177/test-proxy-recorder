---
title: Quick start
description: Scaffold test-proxy-recorder into a project with a single init command, then record once and replay on CI.
---

Install:

```bash
npm install --save-dev test-proxy-recorder
```

## Fastest: scaffold with `init`

One command wires test-proxy-recorder into a project:

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

All arguments are optional and fall back to sensible defaults (`http://localhost:3000`, port `8100`, `./e2e/recordings`). It generates and edits files **non-destructively** — existing files and scripts are never overwritten unless you pass `--force`.

### What `init` generates and edits

- `test-proxy-recorder.config.ts` — the proxy config (auto-discovered, so `npx test-proxy-recorder` then needs no flags).
- `playwright.config.ts` — adds a `webServer` pointing at the proxy's `/__control` endpoint plus a `globalTeardown`. An existing Playwright config is **edited in place**; if you don't have Playwright at all, `init` runs the Playwright CLI to set it up first (pass `--no-install` to skip).
- `e2e/fixtures.ts` and `e2e/global-teardown.ts` — the per-test proxy fixture and teardown.
- `package.json` — adds `proxy`, `proxy:reset`, `test:e2e`, and `test:e2e:record` scripts. If you have a `dev` script it's wrapped: the original moves to `dev:app` and `dev` becomes a `concurrently` command that runs the proxy alongside your app (so `npm run dev` records while you develop). `concurrently` is added to `devDependencies`.

A Playwright config that already defines a `webServer` is left untouched, with a note on what to add.

## The one manual step

The **one step `init` can't do for you** is routing your app's backend calls through the proxy — which env var holds your API base URL, and how you scope it to dev, is app-specific. `init` prints concrete instructions for this when it finishes: point that env var at `http://localhost:8100` **in dev/test only, never in production** (for example, prefix the `dev:app` script, using `cross-env` on Windows). The proxy then forwards to your real backend while recording and serves recordings on replay.

Then write a test, record once against the real API, switch to replay, and commit `e2e/recordings/`. The [manual setup](/docs/getting-started/manual-setup/) shows that loop in full.
