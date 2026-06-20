---
title: AI agent skills
description: Install test-proxy-recorder skills so AI coding agents (Claude Code, Cursor, Copilot) generate correct proxy, fixture, and SSR setup code.
---

If you use an AI coding agent (Claude Code, Cursor, Copilot, and similar), set up skill loading so the agent generates correct setup code. The skills ship inside the `test-proxy-recorder` package via [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) and travel with it through your normal package-manager updates.

**1. Install the library** (skills are discovered from installed packages):

```bash
npm install --save-dev test-proxy-recorder
```

**2. Write the agent guidance** — `install` adds discovery instructions to your agent config (`CLAUDE.md`, `.cursorrules`, etc.) so the agent loads matching package skills on demand:

```bash
npx @tanstack/intent@latest install
```

Pass `--map` if you'd rather write explicit task-to-skill mappings into your agent config instead of generic discovery guidance.

The agent will then know the correct proxy/fixture setup, the record vs. replay workflow, and the Next.js SSR header patterns without needing guidance.

## The skills

`test-proxy-recorder` ships two skills:

- **`proxy-setup`** — the proxy CLI, `package.json` scripts, `playwright.config.ts` `webServer`, per-test fixtures, record/replay/transparent modes, secret redaction, and the record-once → commit → CI-replay lifecycle.
- **`nextjs-ssr`** — tagging server-side fetches with `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, the build-and-start vs `next dev` caveat, and why the middleware is optional.

List what's available from your installed packages, or load one directly:

```bash
npx @tanstack/intent@latest list                          # show discoverable skills
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
```

## Maintaining the skills (for contributors)

The agent skills live in [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Check them periodically — and whenever the library's API or the examples change:

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` must pass; `stale` is advisory — when it reports drift after a release, re-review the affected skill content (and bump its `library_version`).
