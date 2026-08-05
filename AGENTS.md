# AGENTS — structure cheatsheet

Record/replay HTTP+WebSocket proxy for deterministic e2e tests. pnpm monorepo.

## Layout

```text
packages/
  test-proxy-recorder/   # the library + CLI (the product)
    src/
      ProxyServer.ts      # core: record / replay / transparent modes
      httpRecorder.ts     # capture & persist HTTP exchanges
      websocketHandlers.ts# WS record/replay
      replaySessions.ts   # per-test session keying (x-test-rcrd-id)
      cli.ts proxy-cli.ts proxy.ts  # `test-proxy-recorder` CLI entry
      init.ts             # `init` — auto-wire into a project
      config*.ts          # config load/merge
      reset.ts            # reset proxy mode
      nextjs/             # SSR helpers: registerProxyFetch / registerProxyAxios
                          #   / setNextProxyHeaders (middleware) / createHeadersWithRecordingId
      tanstack-start/     # TanStack Start SSR helpers: registerProxyFetch /
                          #   getRecordingId / createHeadersWithRecordingId
      recorderEnabled.ts  # shared isRecorderEnabled() gate for the adapters
      playwright/         # playwrightProxy fixture (before()/teardown())
      utils/              # redact, recordingId, cors, fileUtils, httpHelpers
    skills/               # AI agent skills (intent-managed; 500-line SKILL.md cap,
                          #   bulk in references/). Validate: npx intent validate <dir>
  landing/               # Astro Starlight docs site (the documentation site)
    src/content/docs/docs/  # English source of truth; other locales are translations
apps/                    # runnable examples + e2e suites (the proof the lib works)
  example-nextjs16, example-nextjs-edge, example-tanstack-start,
  example-websocket, example-auth-*, example-extension, example-init
```

Package exports: `.` (Playwright/core), `./playwright`, `./nextjs`, `./tanstack-start`. CLI bin: `test-proxy-recorder`.

## Commands (run from repo root)

```bash
pnpm build         # core library
pnpm lint
pnpm typecheck
pnpm test
pnpm example:test:e2e:ci                      # nextjs16 example — record then replay
pnpm example-edge:test:e2e:ci                 # edge example
pnpm example-tanstack:test:e2e:ci             # TanStack Start example
pnpm landing:dev
pnpm landing:build                            # docs site
pnpm landing:lighthouse                       # Lighthouse audits of the built docs site
```

## Lighthouse (docs site)

`pnpm landing:lighthouse` → `packages/landing/tests/lighthouse.spec.ts`, driven by
`packages/landing/playwright.lighthouse.config.ts`. Everything lives in the landing
package, including the ~100 MB `lighthouse` dependency, because nothing else in the
repo has a use for it. `.github/workflows/lighthouse.yml` runs it on changes under
`packages/landing/**` and nowhere else.

It audits the **production build**, never `astro dev`: the `webServer` block runs
`pnpm run build && astro preview --port 4331`. Port 4331 is deliberately not 4321 —
both `astro dev` and `astro preview` default to that, and a dev server left running
would otherwise be silently accepted in place of the build.

**Seven pages, one per template, not one per route.** The build emits **265**
documents (44 docs pages × 6 locales, plus the marketing page and the 404) and
Starlight renders nearly all of them from one template, so auditing everything
would spend twenty minutes re-measuring three layouts. Each entry in `PAGES`
covers a shape the others don't: the marketing page, the Starlight index, a prose
guide, a page of expressive-code blocks, a TypeDoc-generated API page, a CJK
locale, and the 404. Add one when a genuinely new template lands — not when a new
page uses an existing one.

Desktop config, four categories, **100 on each** — measured August 2026, all seven
pages. Mobile is not what runs; it applies a 4× CPU slowdown that turns the
performance score into a measurement of the runner.

E2e flow: one `next build`, then `next start` serves a record phase (`RECORD_MODE=1`)
then a replay phase in one process. Record against `next start`, never `next dev`.

## Conventions

- Commit/PR only when asked; branch off `master` first. Co-author trailer required.
- **Never publish/release** without explicit approval.
- Docs: edit the English source under `landing/src/content/docs/docs/`; locale
  copies (zh-cn, fr, es, ru, ja) are regenerated separately.
- Skills mirror the library: keep `SKILL.md` concise, push detail into `references/`.
