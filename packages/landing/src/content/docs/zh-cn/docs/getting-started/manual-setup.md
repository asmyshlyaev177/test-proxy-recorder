---
title: 手动配置
description: 为全栈（SSR + 浏览器）应用，或纯浏览器的 SPA / 扩展手动接入 test-proxy-recorder，然后录制一次并在 CI 中回放。
---

更想用一条命令？参见[快速开始](/zh-cn/docs/getting-started/quick-start/)。下面的配置以手动方式完整展示录制 → 回放的循环。

## 全栈（SSR + 浏览器）

适用于 Next.js 等框架，服务端和浏览器都会发起 API 调用。同时使用两种录制机制 —— 参见[工作原理](/zh-cn/docs/getting-started/how-it-works/)。

### 1. 向 `package.json` 添加脚本

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run serve\""
  }
}
```

`INTERNAL_API_URL` 是你的应用用于 API 基础 URL 的环境变量 —— 把它指向代理而不是真实后端。请替换为你的应用实际使用的变量（例如 `API_URL`、`NEXT_PUBLIC_API_URL`）。

:::note[Next.js]
录制和回放测试时，相较 `dev` 更推荐 `build` + `serve`。Next.js 的开发服务器较慢，可能导致超时或不稳定的录制。
:::

### 2. 编写测试

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

### 3. 录制

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. 切换到回放并提交

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## 纯浏览器 / SPA / 扩展

当所有 API 调用都来自浏览器（无 SSR）时，你只需要 HAR 机制。录制本身不需要代理后端 —— 代理进程只负责提供会话管理。

### 1. 安装

```bash
npm install --save-dev test-proxy-recorder
```

### 2. 将代理添加到 `playwright.config.ts`

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

对纯浏览器录制而言，代理目标（`https://api.example.com`）并不重要 —— 它仅在也需要代理服务端（SSR）请求时才会用到。代理进程必须运行，以便其 `/__control` 端点可用于会话管理。

### 3. 编写 fixture

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

### 4. 编写测试

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. 录制 —— 对真实 API 运行一次

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. 切换到回放并提交

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

现在 CI 可以在没有任何网络访问的情况下运行。

:::caution
**不要**把 `e2e/recordings` 加入 `.gitignore`。录制必须在 git 中，CI 才能回放。
:::

把下面这行加入 `.gitattributes`，以便在 PR diff 中折叠较大的录制文件：

```text
/e2e/recordings/** binary
```
