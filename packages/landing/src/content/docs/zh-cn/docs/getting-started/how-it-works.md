---
title: '录制与回放的工作原理：SSR 用代理，浏览器用 HAR'
description: test-proxy-recorder 通过两种机制录制流量：用代理处理服务端请求，用 HAR 处理浏览器端请求，两者可以一起使用，也可以单独使用。
sidebar:
  label: 工作原理
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: e353fcc1cd381fbe245c50f6a5938f7d57ed21e3
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

每个测试在启动时设置它自己会话的模式，而每个请求都在 `x-test-rcrd-id` header 中携带所属测试的 id，所以同时运行的测试各自保持自己的模式和文件。在 **record** 模式下，代理转发到真实后端，并把响应保存到该测试的文件中；在 **replay** 模式下，它从磁盘上该测试的录制中提供已保存的响应；在 **transparent** 模式下，它转发但不录制。2.0.1 及更早的版本对所有请求只保留一个录制会话，所以在这些版本上录制运行需要单个 worker。代理启动时处于 transparent 模式，因此在测试之外通过它运行的应用会照常与后端通信。模式如何切换请参见[控制端点](/zh-cn/docs/guides/control-endpoint/)。

## 回放如何匹配请求 {#replay-matching}

代理和 HAR 文件查找录制响应的方式不同。

| 回放时 | 代理（`.mock.json`） | HAR（`.har`） |
| --- | --- | --- |
| 匹配依据 | 方法、路径、查询字符串的 MD5 哈希，以及请求体，multipart 边界会被忽略。`GET` 和 `HEAD` 不需要请求体即可匹配。不比较请求 header。 | 方法、URL 和请求体，然后选取共有请求 header 最多的条目，因为相同的 URL 和请求体可能是靠某个 header 区分的不同操作。没有任何条目具有该请求体时，退回到只按方法和 URL 匹配；multipart 边界（boundary）会被忽略。 |
| 同一请求再次出现 | 按录制顺序返回请求体相同的下一条录制。 | 按录制顺序返回下一条录制，对写请求有一条规则（见下文）。 |
| 没有录制 | 返回 404，JSON 响应体中指明该请求；`playwrightProxy.before()` 会关闭页面，使测试立即失败（`failOnMissingRecording: false` 可关闭这一行为）。 | 请求被中止，并输出日志 `[Client-Side Replay] No recorded response for <method> <url>`。 |
| 访问真实 API | 仅在 `transparent` 模式下。 | 仅限不匹配 `url` 的请求。 |

### 服务端请求（代理）

键由方法、路径和查询字符串 MD5 哈希的前 16 个十六进制字符组成。`GET /todos?page=2` 的键是 `GET_todos_46589c7afd19c014.json`，所以只要查询字符串有任何不同（哪怕只是参数顺序不同），生成的键就不同。

键相同的调用随后按请求体匹配，因此并行发送的调用（每次运行到达代理的顺序都不同）仍能各自得到自己的响应。比较之前，代理会对两个请求体都应用它的请求体涂抹（`bodyPatterns`），并去掉 multipart 边界，因此被涂抹的机密或每个请求都会变化的边界不会妨碍匹配。`GET` 和 `HEAD` 调用只按键匹配。

如果某个调用的请求体在任何录制中都不存在，它会被当作下文所述的没有录制的请求处理，原因中会指明请求体：`No recording for POST /embeddings with this request body in session <id> (2 recorded with other bodies)`。代理绝不会用为另一个请求体录制的响应来应答它，因为那会掩盖应用所发送内容的变化。请让请求体在各次运行之间保持一致：请求体中的当前日期或随机 id 会导致回放失败。

键和请求体都相同的调用按录制顺序依次应答。超出该请求体最后一条录制的调用会再次得到那条录制的响应，同时代理会记录 `[REPLAY WARNING] All N recordings matching this request already served for <key> (session: <id>), reusing last one`，其中 N 是具有该请求体的录制条数。

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

当你传入 `url` 时，`playwrightProxy.before()` 会用 Playwright 的 HAR 录制器录制匹配的浏览器请求：

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

回放由库自己基于该文件的 `page.route()` 处理函数完成，而不是 `page.routeFromHAR()`。Playwright 的回放对同一请求的每次重复都返回第一条匹配的条目（[microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)），因此 `POST` 之后的 `GET` 显示的是 `POST` 之前的列表。该处理函数则按录制顺序把每条录制只返回一次，仅当页面请求的次数多于录制时才复用其中一条。读请求与写请求之间的顺序由一条规则决定。一旦对某个路径的写请求（除 `GET`、`HEAD` 和 `OPTIONS` 之外的任何方法，因此 GraphQL 查询也算）被回放，对该路径或其下级路径的读请求会优先使用在该写请求之后录制的副本。如果某个读请求在下一个这样的写请求之前已没有剩余的副本，就复用该写请求之前最新的一条。这条规则让应用的读取次数与录制时不同时回放依然正确，例如 React 严格模式下的重复 fetch。录制下来的重定向会在 `.har` 内部直接跟随，因为浏览器的后续请求永远不会到达 `page.route()`：fetch 会拿到最终响应，导航则会被转到重定向的目标。

匹配 `url` 但不在 `.har` 中的请求会被中止。不匹配 `url` 的请求不会被拦截，而在 `transparent` 模式下所有请求都不会被拦截。这些请求会发往真实网络。

发往代理本身（`localhost:8100`）的请求是例外。`before()` 会在 HAR 的处理函数之后为它们注册自己的处理函数，而 Playwright 会先运行后注册的处理函数。该处理函数把这些请求转交给代理，由代理像服务端请求一样从 `.mock.json` 回放。
