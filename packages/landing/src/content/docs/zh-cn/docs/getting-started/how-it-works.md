---
title: '录制与回放的工作原理：SSR 用代理，浏览器用 HAR'
description: test-proxy-recorder 通过两种机制录制流量：用代理处理服务端请求，用 HAR 处理浏览器端请求，两者可以一起使用，也可以单独使用。
sidebar:
  label: 工作原理
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 32bdd456b9abbf2556d3314806353dd2cc86c971
---

test-proxy-recorder 根据请求的来源支持两种录制机制。两者可以一起使用，也可以独立使用。

| 机制 | 录制内容 | 适用场景 |
| --------- | --------------- | -------- |
| **代理** (`.mock.json`) | 服务端请求（Next.js 等的 SSR fetch） | 服务端调用 API 的全栈应用 |
| **HAR** (`.har`) | 浏览器端请求（浏览器 `fetch`、扩展、SPA） | SPA、Chrome 扩展、第三方 API |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

每个测试在启动时设置模式，而代理对它收到的所有请求都使用同一种模式，所以同时运行的测试共用这一模式。在 **record** 模式下，代理转发到真实后端并保存响应；在 **replay** 模式下，它从磁盘提供已保存的响应，并由每个测试的 id 选出该测试的录制；在 **transparent** 模式下，它转发但不录制。代理启动时处于 transparent 模式，因此在测试之外通过它运行的应用会照常与后端通信。模式如何切换请参见[控制端点](/zh-cn/docs/guides/control-endpoint/)。

## 回放如何匹配请求 {#replay-matching}

代理和 HAR 文件查找录制响应的方式不同。

| 回放时 | 代理（`.mock.json`） | HAR（`.har`） |
| --- | --- | --- |
| 匹配依据 | 方法、路径，以及查询字符串的 MD5 哈希。不比较请求体。 | 方法和 URL；对 `POST` 还会比较请求体（[Playwright 的规则](https://playwright.dev/docs/mock#replaying-from-har)）。 |
| 同一请求再次出现 | 按录制顺序返回下一条录制。 | 返回匹配 header 最多的条目，忽略录制顺序。 |
| 没有录制 | 返回 404，JSON 响应体中指明该请求；`playwrightProxy.before()` 会关闭页面，使测试立即失败（`failOnMissingRecording: false` 可关闭这一行为）。 | 请求被中止。 |
| 访问真实 API | 仅在 `transparent` 模式下。 | 仅限不匹配 `url` 的请求。 |

### 服务端请求（代理）

键由方法、路径和查询字符串 MD5 哈希的前 16 个十六进制字符组成。`GET /todos?page=2` 的键是 `GET_todos_46589c7afd19c014.json`，所以只要查询字符串有任何不同（哪怕只是参数顺序不同），生成的键就不同。

键相同的调用按录制顺序依次应答。超出最后一条录制的调用会再次得到最后一个响应，同时代理会记录 `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`。

没有录制的请求不会访问真实 API。代理会输出 `[REPLAY ERROR]` 日志行，并以 404 应答：

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

代理只在 `transparent` 模式下把请求发往真实后端。回放运行会通过两种途径进入这一模式：`playwrightProxy.teardown()` 在测试仍在进行时运行了，或者会话超时（默认 120000 ms）在下一次 `playwrightProxy.before()` 调用之前耗尽。[常见问题](/zh-cn/docs/reference/faq/#parallel-replay)对这两种情况都有解释。

### 浏览器请求（HAR）

当你传入 `url` 时，`playwrightProxy.before()` 会把浏览器请求交给 Playwright 的 HAR 路由：

```typescript
await page.routeFromHAR(harPath, { url, update: mode === 'record', updateContent: 'embed' });
```

Playwright 的 `notFound` 选项默认为 `'abort'`，所以在回放时，匹配 `url` 但不在 `.har` 中的请求会被中止。不匹配 `url` 的请求不会被拦截。无论录制还是回放，它们都会发往真实网络。

发往代理本身（`localhost:8100`）的请求是例外。`before()` 会在 HAR 的处理函数之后为它们注册自己的处理函数，而 Playwright 会先运行后注册的处理函数。该处理函数把这些请求转交给代理，由代理像服务端请求一样从 `.mock.json` 回放。
