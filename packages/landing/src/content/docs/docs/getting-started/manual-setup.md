---
title: Manual setup
description: Wire test-proxy-recorder into a full-stack (SSR + browser) app or a browser-only SPA or extension by hand, then record once and replay on CI.
---

Most people should run [`init`](/docs/getting-started/quick-start/) — it writes every file below for you. This page is the reference for what `init` generates, so you can wire it up by hand, drop codegen, or understand each piece.

## Full-stack (SSR + browser)

For Next.js and similar frameworks, where both the server and the browser make API calls. Use both recording mechanisms together — see [how it works](/docs/getting-started/how-it-works/).

The proxy is a lightweight process you start **alongside your app for the test run** (via a script, as below, or Playwright's `webServer`) — it's not infrastructure you deploy or maintain. The whole setup is: start it next to your app, point your app's API base URL at it, propagate the session header from SSR, and write one fixture.

### 1. Add scripts to `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

In your app code, point the API base URL at the proxy when the recorder is enabled, at the real backend otherwise — the proxy never runs in production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // proxy address
```

`TEST_PROXY_RECORDER_ENABLED` is set by the `dev:proxy` / `serve:proxy` scripts above, and by `init`'s generated scripts. Use whatever env var your app already uses for the API base URL (for example `API_URL`, `NEXT_PUBLIC_API_URL`) — the same conditional applies.

:::note[Next.js]
Prefer `build` + `serve` over `dev` for recording and replaying tests. The Next.js dev server is slow and can cause timeouts or flaky recordings.
:::

### 2. Propagate the SSR session header (Next.js)

Server-side `fetch` calls need the recording-session header forwarded so the proxy knows which test they belong to. Add a middleware — `proxy.ts` on Next.js 16+, `middleware.ts` on 15 and earlier (`init` writes this for you):

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

See the [Next.js integration](/docs/integrations/nextjs/) for the Edge runtime and manual header forwarding. Browser-only apps can skip this step.

### 3. Write a test

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR requests (server → proxy) are recorded to .mock.json.
// Browser requests to the proxy URL are also covered.
const CLIENT_SIDE_URL = /localhost:8100/;

// Change to 'record' to update recordings.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Record

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 5. Switch to replay and commit

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Browser-only / SPA / extension

When all API calls come from the browser (no SSR), you only need the HAR mechanism. No proxy backend is required for the actual recording — the proxy process just provides session management.

### 1. Install

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Add the proxy to `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

The proxy target (`https://api.example.com`) does not matter for browser-only recording — it is only used if server-side (SSR) requests also need to be proxied. The proxy process must run so its `/__control` endpoint is available for session management.

### 3. Write a fixture

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Match the external API domain your browser makes requests to.
// In record mode these requests go to the real API and are saved.
// In replay mode they are served from disk — no network needed.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. Write a test

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Record — run once against the real API

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. Switch to replay and commit

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

CI now runs without any network access.

:::caution
Do **not** add `e2e/recordings` to `.gitignore`. Recordings must be in git for CI replay.
:::

Add this to `.gitattributes` to collapse large recording files in PR diffs:

```text
/e2e/recordings/** binary
```
