---
title: Manual setup
description: Wire test-proxy-recorder into a full-stack (SSR + browser) app or a browser-only SPA or extension by hand, then record once and replay on CI.
---

Prefer one command? See the [quick start](/docs/getting-started/quick-start/). The setups below show the full record → replay loop by hand.

## Full-stack (SSR + browser)

For Next.js and similar frameworks, where both the server and the browser make API calls. Use both recording mechanisms together — see [how it works](/docs/getting-started/how-it-works/).

### 1. Add scripts to `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run serve\""
  }
}
```

`INTERNAL_API_URL` is the env var your app uses for the API base URL — point it at the proxy instead of the real backend. Replace it with whatever env var your app uses (for example `API_URL`, `NEXT_PUBLIC_API_URL`).

:::note[Next.js]
Prefer `build` + `serve` over `dev` for recording and replaying tests. The Next.js dev server is slow and can cause timeouts or flaky recordings.
:::

### 2. Write a test

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

### 3. Record

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. Switch to replay and commit

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
