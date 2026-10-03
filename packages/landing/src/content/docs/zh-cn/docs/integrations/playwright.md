---
title: 'Playwright 设置：录制与回放每个测试'
description: 用 test-proxy-recorder 在 Playwright 测试中录制与回放 API 调用，借助 before() 会话钩子、推荐的 global teardown，以及每个测试各自的录制文件。
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 26b8b462ae4153046421443a751392892c37c34b
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

在每个测试开头调用它（或放在 `beforeEach` / 页面 fixture 中）。它为该会话设置代理模式，并在提供了 `url` 时为浏览器端请求设置 HAR 录制。

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**`url` 模式：** 匹配浏览器调用的真实外部域名。在 record 模式下，请求会发往真实 API 并保存到 `.har` 文件；在 replay 模式下，则从该文件提供 —— 无需网络。此模式**不**指向代理（`localhost:8100`）。

**例外 —— 全栈应用：** 当浏览器也调用 `localhost:8100`（因为前端把代理 URL 配置为其 API 基础地址）时，请用 `/localhost:8100/` 作为模式。这些浏览器请求随后会透传给代理，由代理把它们录制到该测试的 `.mock.json` 中并从中回放，所以缺失的请求会得到代理的 404，而不是被 HAR 中止（参见[回放如何匹配请求](/zh-cn/docs/getting-started/how-it-works/#replay-matching)）。

录制文件名由测试名推导（`"create a user"` → `create-a-user.mock.json` / `.har`）。

## Global teardown（推荐）{#global-teardown-recommended}

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` 会把代理重置为 `transparent`，并运行 HAR 的[涂抹](/zh-cn/docs/guides/secret-redaction/)处理。不要在 `fullyParallel` 下的每个测试的 `afterAll` 钩子里调用它 —— 原因参见[常见问题](/zh-cn/docs/reference/faq/#parallel-replay)，它会破坏并行回放。

## 录制文件

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
