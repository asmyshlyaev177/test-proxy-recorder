---
title: Quick start
description: One init command scaffolds test-proxy-recorder — Next.js SSR middleware included. Point your API at the proxy, record once, replay on CI.
---

## 1. Scaffold

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

This writes everything and overwrites nothing:

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # Next.js only — SSR middleware
e2e/fixtures.ts          # record vs replay
e2e/global-teardown.ts
package.json             # + proxy / test:e2e scripts
```

## 2. Point your app's API at the proxy

The one thing `init` can't guess: which env var holds your API base URL. Point it at the proxy when the recorder is enabled, at the real backend otherwise — the proxy never runs in production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // proxy address from `init`
```

## 3. Record once, replay forever

```bash
# fixtures.ts: MODE = 'record' — capture real responses
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — then commit the recordings
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

CI now replays with the backend off — same responses every time.

---

Wiring it up by hand, or want the details? See [manual setup](/docs/getting-started/manual-setup/) and [how it works](/docs/getting-started/how-it-works/).
