---
title: Quick start
description: Set up test-proxy-recorder with one init command — best driven by an AI agent. Point your API at the proxy, record once, replay on CI.
---

## Set up with an AI agent (recommended)

Copy this, swap in your backend URL, and paste it into your AI coding agent (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

The agent adds the skills, scaffolds everything with `init` (config, Playwright fixture, teardown, scripts, and — on Next.js — `registerProxyFetch()` in your root layout), then finishes the wiring `init` can't guess from the prompt `init` prints. Want a finished setup to copy from? See the [examples](/docs/reference/examples/).

## Or wire it by hand

`init` writes everything and overwrites nothing:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # Next.js only — adds registerProxyFetch() to tag SSR fetches
e2e/fixtures.ts          # record vs replay
e2e/global-teardown.ts
package.json             # + proxy / test:e2e scripts
```

### 1. Point your app's API at the proxy

The one thing `init` can't guess: which env var holds your API base URL. Point it at the proxy when the recorder is enabled, at the real backend otherwise — the proxy never runs in production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // proxy address from `init`
```

### 2. Tag server-side fetches (Next.js only)

Browser requests already carry the recording-session id (Playwright sets it). For
server-side fetches (SSR, Server Components), add one line to your root layout so
they're tagged too — `init` does this for you:

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Using axios for server-side calls? Use `registerProxyAxios(instance)` instead.
Record against a production build (`next build && next start`), not `next dev`.
Browser-only apps (SPA, extension) can skip this step.

### 3. Record once, replay forever

```bash
# fixtures.ts: MODE = 'record' — capture real responses
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — then commit the recordings
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

CI now replays with the backend off — same responses every time.

---

More detail: [manual setup](/docs/getting-started/manual-setup/) · [how it works](/docs/getting-started/how-it-works/) · [AI agent skills](/docs/reference/ai-agent-skills/).
