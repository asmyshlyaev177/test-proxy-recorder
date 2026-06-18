# test-proxy-recorder

> **VCR for Playwright** — record real API responses once, replay them deterministically on CI. Covers Next.js SSR, browser, and WebSocket traffic. No backend, no hand-written mocks.

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Recording real API responses, then replaying them on CI with the backend turned off" width="800">
</p>

Fast, deterministic Playwright tests without maintaining manual mocks. The proxy records real API responses during a test run, then replays them on CI — no backend, no flaky network.

```text
                        Record mode                          Replay mode

  Browser/App ──> Proxy ──> Real API        Browser/App ──> Proxy ──> Disk
                    │                                         │
                    └──> saves to disk                        └──> serves saved responses
                         (.mock.json)                              (.mock.json)
```

## 📖 Documentation

**Full docs, guides, and the API reference live at [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/).**

- [Quick start](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [Manual setup](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/) · [How it works](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/)
- [CLI](https://test-proxy-recorder.dev/docs/guides/cli/) · [Config file](https://test-proxy-recorder.dev/docs/guides/config/) · [Secret redaction](https://test-proxy-recorder.dev/docs/guides/secret-redaction/) · [Control endpoint](https://test-proxy-recorder.dev/docs/guides/control-endpoint/)
- Integrations: [Playwright](https://test-proxy-recorder.dev/docs/integrations/playwright/) · [Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/)
- Reference: [Example apps](https://test-proxy-recorder.dev/docs/reference/examples/) · [API](https://test-proxy-recorder.dev/docs/reference/api/readme/) · [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/)

## Why

- **No backend on CI** — record once against the real API, replay on every CI run
- **No manual mocks** — capture real interactions instead of hand-writing fixtures
- **SSR support** — records server-side requests from Next.js and similar frameworks
- **Browser-side support** — records browser `fetch` calls, Chrome extension API calls, analytics, etc.
- **Deterministic** — same responses every time, no flaky network
- **WebSocket support** — records and replays WebSocket connections

## Comparison

test-proxy-recorder is the one that records **real** traffic across SSR, browser, and WebSockets without hand-written mocks — that combination is the gap the others leave open.

| Feature | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Record real traffic | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Server-side (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Browser-side | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Playwright-native | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Maintained | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

See the [full comparison](https://test-proxy-recorder.dev/docs/#comparison) — including when to reach for something else.

## Quick start

Install:

```bash
npm install --save-dev test-proxy-recorder
```

Scaffold the whole setup with one command:

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

It wires up the proxy config, a Playwright fixture, a global teardown, and `package.json` scripts — non-destructively. Then write a test, record once against the real API, switch to replay, and commit `e2e/recordings/`.

Full walkthrough — including the manual setup for full-stack (SSR) and browser-only apps — is in the [quick start](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) and [manual setup](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/) guides.

## Example apps

Full working examples live in [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), each with its own README:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — server-side (`.mock.json`) + browser (`.har`), with a WebSocket chat
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — SSR on the Edge runtime, with `registerProxyFetch` tagging server-side fetches so concurrent replay sessions stay distinct
- [Chrome extension](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — browser-side (`.har`), replayed offline
- [Crypto ticker](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — third-party WebSocket feed, replayed deterministically
- [Authenticated app](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — real AWS Cognito login, protected API replayed with no backend

## AI agent skills

Using an AI coding agent (Claude Code, Cursor, Copilot, etc.)? Install the skills so it generates correct setup code:

```bash
npx @tanstack/intent@latest install
```

More in the [AI agent skills guide](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Roadmap

First-class integrations on the way: **TanStack Start**, **Remix / React Router 7**, **Vite + SSR**. Need one sooner, or a different framework? [Open an issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).

## Requirements

- Node.js >= 20.0.0
- @playwright/test >= 1.0.0 (peer dependency)

## Contributing

Contributions welcome! Please submit a Pull Request. The agent skills live in [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/) — see the [skills guide](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/#maintaining-the-skills-for-contributors) for how to validate them.

## License

MIT
