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
      playwright/         # playwrightProxy fixture (before()/teardown())
      utils/              # redact, recordingId, cors, fileUtils, httpHelpers
    skills/               # AI agent skills (intent-managed; 500-line SKILL.md cap,
                          #   bulk in references/). Validate: npx intent validate <dir>
  landing/               # Astro Starlight docs site (the documentation site)
    src/content/docs/docs/  # English source of truth; other locales are translations
apps/                    # runnable examples + e2e suites (the proof the lib works)
  example-nextjs16, example-nextjs-edge, example-websocket,
  example-auth-*, example-extension, example-init
```

Package exports: `.` (Playwright/core), `./playwright`, `./nextjs`. CLI bin: `test-proxy-recorder`.

## Commands (run from repo root)

```bash
pnpm build         # core library
pnpm lint
pnpm typecheck
pnpm test
pnpm example:test:e2e:ci                      # nextjs16 example — record then replay
pnpm example-edge:test:e2e:ci                 # edge example
pnpm landing:dev
pnpm landing:build                            # docs site
```

E2e flow: one `next build`, then `next start` serves a record phase (`RECORD_MODE=1`)
then a replay phase in one process. Record against `next start`, never `next dev`.

## Conventions

- Commit/PR only when asked; branch off `master` first. Co-author trailer required.
- **Never publish/release** without explicit approval.
- Docs: edit the English source under `landing/src/content/docs/docs/`; locale
  copies (zh-cn, fr, es, ru, ja) are regenerated separately.
- Skills mirror the library: keep `SKILL.md` concise, push detail into `references/`.
