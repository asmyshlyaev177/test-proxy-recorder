---
title: 常见问题
description: 关于 test-proxy-recorder 的常见问题 —— 并行回放、把录制提交到 git、HAR 录制的代理目标、Next.js 开发服务器，以及如何更新录制。
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
---

## 我的并行回放测试有时会访问真实后端 —— 为什么？{#parallel-replay}

你很可能在每个测试的钩子里调用了 `playwrightProxy.teardown()`。它会把代理的**全局**模式设为 `transparent`，而在 `fullyParallel: true` 下，每个 Playwright worker 都会运行自己的 `test.afterAll`。如果一个快的测试结束并调用 `teardown()`，而一个较慢的测试仍在运行，代理就会在测试中途切到 transparent，剩余请求便会被转发到真实后端，而不是被回放。

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**解决办法：** 省略 `test.afterAll`。会话清理会通过 `context.on('close')` → `cleanupSession()` 自动完成。仅当你需要在整个运行结束后重置代理时，才使用 [global teardown](https://playwright.dev/docs/test-global-setup-teardown)。

回放运行访问真实后端的另一种途径是会话超时。每次调用 `playwrightProxy.before()` 都会重新开始计时，经过代理的请求则不会。如果在下一次 `before()` 调用之前超时（默认 120000 ms），代理就会切换到 `transparent`。这时仍在运行的测试会把剩余请求发往真实后端。如果单个测试可能运行这么久，请用 [CLI](/zh-cn/docs/guides/cli/) 的 `--timeout` 或[配置](/zh-cn/docs/guides/config/)中的 `timeout` 调高超时时间。

## 可以用并行 worker 录制吗？{#parallel-recording}

不可以。代理同一时间只持有一个录制会话。当第二个测试开始录制时，代理会保存第一个测试的文件并切换到第二个测试。之后，第一个测试经过代理的剩余请求就会进入第二个测试的 `.mock.json`。请用单个 worker 录制，`init` 添加的 `test:e2e:record` 脚本已经这样做了：

```bash
npx playwright test --workers 1
```

回放可以使用并行 worker。每个测试回放自己的会话，靠 `x-test-rcrd-id` header 区分彼此：`playwrightProxy.before()` 把它设置在页面的请求上，`registerProxyFetch()` 则把它复制到服务端请求上。[示例应用](/zh-cn/docs/reference/examples/)正是出于这个原因用 `--workers 1` 录制。

## 我应该把录制提交到 git 吗？

应该。录制必须在 git 中，CI 才能在无网络下回放 —— **不要**把 `e2e/recordings` 加入 `.gitignore`。为避免较大的录制文件挤占 PR 审阅，在 `.gitattributes` 中把它们标记为生成文件：GitHub 默认折叠它们的 diff，但仍可一键展开，所以 API 重命名的字段在审阅中依然可见。若标记为 `binary`，这类变化就会被完全隐藏。

```text
/e2e/recordings/** linguist-generated=true
```

## 对纯浏览器（HAR）录制而言，代理的 `<target-url>` 重要吗？

不重要。对纯浏览器录制，目标无关紧要 —— 代理进程只需运行，使其 `/__control` 端点可用于会话管理即可。只有在服务端（SSR）请求也经由代理路由时，目标才重要。

## `url` 模式之外的浏览器请求会怎样？{#outside-url}

Playwright 不会拦截它们，所以无论录制还是回放，它们都会发往真实网络，也不会为它们保存任何内容。发往代理（`localhost:8100`）的请求是例外。`playwrightProxy.before()` 总会把这些请求转交给代理，由代理自己录制和回放。

要让测试不访问网络，可以放宽 `url`，让 HAR 覆盖该域名；或者用 `page.route()` 和 `route.abort()` 屏蔽该域名：

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // HAR 也会录制并回放 CDN 的请求。
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // 分析调用会直接失败，而不会访问网络。
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

详情参见[回放如何匹配请求](/zh-cn/docs/getting-started/how-it-works/#replay-matching)。

## 我能对 Next.js 开发服务器录制吗？

录制和回放时，相较 `next dev` 更推荐 `next build` + `next start`。开发服务器较慢，可能导致超时或不稳定的录制。

## 如何更新一份录制？

在 record 模式下重新运行（`RECORD_MODE=1`，即 `test:e2e:record` 脚本）对真实 API 录制，然后提交 `e2e/recordings/` 中更新后的文件。

## 能否在回放测试中强制返回错误、空列表或慢响应？{#override-responses}

对浏览器请求可以。Playwright 按[与注册相反的顺序](https://playwright.dev/docs/api/class-route#route-fallback)运行路由处理函数，所以在 `playwrightProxy.before()` 之后添加的 `page.route()` 会最先看到每个请求。它可以自己应答请求，也可以调用 `route.fallback()` 把请求交给录制处理。

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // 在 before() 之后添加，所以 Playwright 会先运行这个处理函数。
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // 其他所有请求都按录制内容回放
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

要返回空列表，就在 fulfill 时改用 `json: []`。要模拟慢响应，可以在调用 `route.fallback()` 之前等待，例如用 `await new Promise((resolve) => setTimeout(resolve, 3000))`。这样录制的响应会晚三秒到达。

服务端请求从不经过浏览器，所以 `page.route()` 无法改变它们。对于这类请求，可以手动编辑 `.mock.json` 中的录制，或者在 API 处于你所需的状态时录制。在该文件中，每条录制的 `response` 都包含 `statusCode`、`headers` 和 `body`。如果你改变了 body 的长度，还要删除 `content-length` header。

## 测试套件针对的是已部署环境时，还能用吗？{#deployed-environment}

对浏览器请求可以。Playwright 在浏览器中拦截它们，所以 HAR 无需改动已部署的应用就能录制和回放这些请求。把 `url` 指向浏览器调用的 API 域名即可。代理仍然需要在测试旁运行，因为 `playwrightProxy.before()` 要通过代理的 `/__control` 端点设置每个测试的模式。

服务端请求由应用的服务器发出，所以 CI 中的代理永远看不到已部署服务器发出的请求。要录制或回放它们，请在 CI 中把应用的服务器和代理放在一起运行。为测试运行构建并启动它，把它的 API 基础 URL 指向代理，并设置 `TEST_PROXY_RECORDER_ENABLED=true`。[Next.js](/zh-cn/docs/integrations/nextjs/) 和 [TanStack Start](/zh-cn/docs/integrations/tanstack-start/) 页面展示了这种配置。
