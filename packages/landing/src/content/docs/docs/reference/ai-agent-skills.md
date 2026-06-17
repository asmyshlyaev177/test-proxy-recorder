---
title: AI agent skills
description: Install test-proxy-recorder skills so AI coding agents (Claude Code, Cursor, Copilot) generate correct proxy, fixture, and SSR setup code.
---

If you use an AI coding agent (Claude Code, Cursor, Copilot, and similar), install the skills for this library so the agent generates correct setup code:

```bash
npx @tanstack/intent@latest install
```

This adds `test-proxy-recorder` skills to your project. The agent will then know the correct proxy/fixture setup, the record vs. replay workflow, and the Next.js SSR header patterns without needing guidance.

## Maintaining the skills (for contributors)

The agent skills live in [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Check them periodically — and whenever the library's API or the examples change:

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` must pass; `stale` is advisory — when it reports drift after a release, re-review the affected skill content (and bump its `library_version`).
