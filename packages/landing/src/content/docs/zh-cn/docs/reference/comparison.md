---
title: 'test-proxy-recorder 对比 MSW、routeFromHAR、Polly.js 和 Next.js test mode'
description: 'test-proxy-recorder 与 MSW、routeFromHAR、Polly.js、Next.js test mode、mockttp、Mocky Balboa、scenarist、talkback 和 proxay 的对比，附来源。'
sidebar:
  label: 对比
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

这里的每个工具都能控制端到端测试看到的 API 响应。它们的区别在于在哪里拦截请求（在浏览器中、在你的服务器内部，还是在一个独立的代理中），以及响应是由你编写还是录制而来。下表保留了[文档概览](/zh-cn/docs/#comparison)中的六个工具，并加入了 Next.js test mode、mockttp、scenarist、talkback 和 proxay。每个单元格都来自该工具自己的文档、README 或源代码（链接列在表格下方），信息截至 2026-10-03。“文档未提及”表示这些来源中没有相关说明。

## 功能对比表 {#table}

| 工具 | 录制真实流量 | 服务端（SSR） | 浏览器端 | WebSocket | Playwright 原生 | 最新版本 |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | 是 | 是，通过代理 | 是，通过 HAR | 是 | 是 | 1.3.1，2026-08-05 |
| Playwright `routeFromHAR` | 是 | 否 | 是 | 否 | 内置 | Playwright 1.63.0，2026-09-04 |
| MSW | 否（handler，或通过 `@msw/source` 使用 HAR） | 在服务器进程内部 | 是 | 是 | `@msw/playwright`，针对浏览器请求 | 3.0.2，2026-10-03 |
| Polly.js | 是 | 在服务器进程内部 | 是 | 文档未提及 | 第三方适配器 | `@pollyjs/core` 6.0.6，2023-07-20 |
| playwright-network-cache | 是 | 否 | 是 | 文档未提及 | 是 | 0.3.0，2026-05-12 |
| Mocky Balboa | 否（handler） | 是 | 是 | 文档未提及 | 是 | `@mocky-balboa/playwright` 2.0.2，2026-05-21 |
| Next.js test mode | 否（handler） | 是，仅限 Next.js | 发往其他源的请求 | 文档未提及 | 是 | 实验性，包含于 Next.js 16.3.8，2026-09-30 |
| mockttp | 文档未提及 | 是，作为正向代理 | 是，作为浏览器的代理 | 是 | 否，需要你自己编写 fixture | 4.6.3，2026-09-11 |
| scenarist | 否（在代码中编写场景） | Next.js 和 Express | 否 | 文档未提及 | 是 | 0.5.1，2026-09-27 |
| talkback | 是 | 是，作为 API 的地址 | 文档未提及 | 文档未提及 | 否 | 4.2.0，2024-07-10 |
| proxay | 是 | 是，作为 API 的地址 | 是，作为 API 的地址 | 文档未提及 | 否 | npm 1.9.0，2024-05-15；GitHub 2.0.0，2026-01-29 |

## 来源与说明 {#sources}

除非链接的是 GitHub release，发布日期均来自 npm registry。

- **test-proxy-recorder：** 服务端调用经过代理，浏览器调用经过 HAR（[工作原理](/zh-cn/docs/getting-started/how-it-works/)）。录制的 WebSocket 消息由代理回放（[CLI](/zh-cn/docs/guides/cli/#websocket-replay-pacing)）。版本：[npm](https://www.npmjs.com/package/test-proxy-recorder)。
- **Playwright `routeFromHAR`：** 设置 `update: true` 时，它会根据真实流量录制 HAR（[Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)）。回放时，它提供的是“页面中发出的网络请求”（[API](https://playwright.dev/docs/api/class-page#page-route-from-har)）。它通过 `route()` 处理函数来 fulfill HTTP 请求，没有处理 WebSocket 的路径（[`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)）。版本：[v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0)。
- **MSW：** 请求 handler 由你编写。MSW 本身不录制任何内容，但 [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) 可以根据你从浏览器 DevTools 导出的 HAR 文件生成 handler。在 Node.js 中，它运行在发出请求的进程内部（[`setupServer`](https://mswjs.io/guides/integrations/node)）。WebSocket 使用 [`ws` API](https://mswjs.io/docs/websocket)。官方的 [`@msw/playwright`](https://github.com/mswjs/playwright) 绑定通过 `page.route()` 路由请求，因此覆盖的是浏览器请求。版本：[v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2)。
- **Polly.js：** 它的[仓库](https://github.com/Netflix/pollyjs)把它描述为“录制、回放和打桩 HTTP 交互”。[node-http 适配器](https://netflix.github.io/pollyjs/#/adapters/node-http)会 patch Node 的 `http` 和 `https` 模块，[fetch 适配器](https://netflix.github.io/pollyjs/#/adapters/fetch)则包装全局 `fetch`。因此 Polly 在运行它的进程内部录制。它的文档没有列出 WebSocket 适配器。Playwright 支持来自第三方的 [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright)，[Polly 的文档](https://netflix.github.io/pollyjs/#/adapters/playwright)也链接到了它。版本：[npm](https://www.npmjs.com/package/@pollyjs/core)。
- **playwright-network-cache：** 它的 [README](https://github.com/vitalets/playwright-network-cache) 说它“通过把网络请求缓存到文件系统”来加速 Playwright 测试。`CacheRoute` 用 `page.route()` 拦截（[源代码](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)），所以它只能看到浏览器请求。版本：[npm](https://www.npmjs.com/package/playwright-network-cache)。
- **Mocky Balboa：** 你在测试中定义 mock，通过同一套 API 覆盖服务端和客户端请求。测试并行运行时，各个测试的 mock 相互隔离（[功能](https://docs.mockybalboa.com/docs/features/)）。对于 Next.js 14 及以上版本，它的 CLI 会启动你的 Next.js 服务器（[Next.js](https://docs.mockybalboa.com/docs/server/next-js/)）。它的文档只把 WebSocket 作为你的服务器与测试运行器之间的通信通道提及。版本：[npm](https://www.npmjs.com/package/@mocky-balboa/playwright)。
- **Next.js test mode：** 用 `next.onFetch()` 注册的 handler 会收到服务器的 `fetch` 调用，以及页面发往其他源的 `fetch` 调用（[README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md)、[`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)）。[服务端 mock](/zh-cn/docs/guides/server-side-mocking/#nextjs-test-mode) 介绍了它的配置、现状以及它与 MSW 3 的问题。版本：[Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8)。
- **mockttp：** 一个 HTTP 和 HTTPS 的 mock 服务器兼代理，面向“在 node 或浏览器中”运行的测试（[README](https://github.com/httptoolkit/mockttp)）。`forAnyWebSocket()` 可以 mock WebSocket 连接（[源代码](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)）。README 没有描述录制模式。Playwright 团队的[文章](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)展示了需要编写的 fixture。版本：[npm](https://www.npmjs.com/package/mockttp)。
- **scenarist：** 它的 [README](https://github.com/citypaul/scenarist) 说它“基于 MSW 构建，提供运行时场景管理和测试 ID 隔离”，场景由你在代码中编写。它的 FAQ 说它“提供服务端场景管理，与 Playwright 的客户端 mock 互补”。你的服务器代码要在每个 `fetch` 上转发 `x-scenarist-test-id`（[Next.js 适配器](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)），`@scenarist/playwright-helpers` 则提供 Playwright fixture。版本：[npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter)。
- **talkback：** “一个录制并回放 HTTP 请求的 JavaScript HTTP 代理”（[README](https://github.com/ijpiantanida/talkback)）。你的应用把请求发给 talkback。匹配已保存 tape 的请求会得到该 tape 的响应，未知的请求则被转发到目标主机，并保存为新的 tape。README 既没有提到浏览器，也没有提到按测试划分的 tape。版本：[npm](https://www.npmjs.com/package/talkback)。
- **proxay：** 一个录制与回放代理，用于“Web 前端与其后端之间”或“一台服务器与另一台服务器之间”（[README](https://github.com/airtasker/proxay)）。测试通过 `POST /__proxay/tape` 选择 tape，例如在 `beforeEach` 中选择；README 没有涉及并行测试。2.0.0 版本是一个 [GitHub release](https://github.com/airtasker/proxay/releases/tag/v2.0.0)；[npm](https://www.npmjs.com/package/proxay) 上提供的仍是 1.9.0。

## Playwright 下的 Polly.js 替代方案 {#pollyjs}

Netflix 出品的 Polly.js 可以录制、回放和打桩 HTTP，它也是 test-proxy-recorder 的灵感来源。它在 2026-10-03 的状况如下：

- `@pollyjs/core` 自 2023-07-20 发布 6.0.6 以来再没有发布新版本。仓库的最后一次变更在 2025-05-31，发布了 `@pollyjs/adapter-fetch` 6.0.7，取消了 fetch 适配器在 Node 上的弃用状态（[Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)）。
- Polly 没有自己的 Playwright 适配器。它的文档指向第三方的 [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright)，该适配器挂接到浏览器 context 或 page 上。它的最后一个版本 2.4.0 发布于 2024-04-18。
- 对于服务端调用，Polly 必须通过它的 node-http 或 fetch 适配器运行在服务器进程内部。

如果你正在从 Polly.js 迁移，它的概念与 test-proxy-recorder 的对应关系如下。

| Polly.js | test-proxy-recorder |
| --- | --- |
| `record`、`replay` 和 `passthrough` 模式（[配置](https://netflix.github.io/pollyjs/#/configuration)） | `record`、`replay` 和 `transparent` 模式，由 `playwrightProxy.before()` 按测试设置 |
| 每个 Polly 实例一份命名录制，由 persister 保存 | 每个 Playwright 测试一个 `.mock.json`（服务端）和一个 `.har`（浏览器），位于录制目录中 |
| 适配器位于发出请求的进程内部 | 服务端调用用代理进程，浏览器调用用 HAR，服务器上再加 `registerProxyFetch()` |
| 默认按方法、header、请求体、顺序和 URL 匹配请求 | 服务端请求按方法、路径和查询字符串的哈希匹配，按录制顺序应答，不比较请求体。浏览器请求遵循 Playwright 的 HAR 规则，该规则还会比较 POST 请求体 |

## 在 Next.js 和 Playwright 中使用 MSW {#msw}

在 Next.js 应用中，浏览器请求和服务端请求需要不同的 MSW 配置。

- **浏览器请求：** 官方绑定 [`@msw/playwright`](https://github.com/mswjs/playwright) 通过 `page.route()` 运行你的 handler，并提供一个可以按测试修改的 `network` fixture。
- **服务端请求：** MSW 运行在 Next.js 进程内部。MSW 的文档没有 Next.js 指南，参考示例是一个仍处于打开状态的 pull request：[mswjs/examples#101](https://github.com/mswjs/examples/pull/101)。你在运行时修改的 handler 会被访问该服务器的所有测试共享。详情和来源参见[服务端 mock](/zh-cn/docs/guides/server-side-mocking/#msw)。
- **按测试划分的服务端 handler：** Next.js test mode 支持按测试使用 MSW handler，但它的 MSW 入口在 MSW 3.0 下无法加载（[详情](/zh-cn/docs/guides/server-side-mocking/#nextjs-test-mode)）。scenarist 在 MSW 之上为 Next.js 和 Express 构建按测试划分的场景，你的服务器代码要在每个 `fetch` 上转发一个测试 id header。
- **录制：** MSW 不录制流量。[`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) 可以把从浏览器 DevTools 导出的 HAR 文件转换成 handler。

test-proxy-recorder 做了相反的取舍。它从真实 API 录制服务端和浏览器两侧的请求，所以不需要编写 handler。代价是，对于 API 不会按需产生的响应，你能施加的控制更少。

## 何时选择其他工具 {#when-to-use-something-else}

- **你的全部流量都在浏览器端：** Playwright 内置的 `routeFromHAR` 不需要额外依赖。先从它开始，等出现服务端请求时再加上 test-proxy-recorder。
- **你想手工编写响应，或强制返回错误和边界情况：** MSW 的 handler 更适合，而且 MSW 不仅能在 Playwright 中运行，还能在 [Vitest](https://mswjs.io/guides/integrations/vitest)、[Storybook](https://mswjs.io/guides/integrations/storybook) 和[浏览器](https://mswjs.io/guides/integrations/browser)中运行。如果需要在 Playwright 中按测试划分的服务端 handler，可以看看 Mocky Balboa、scenarist 或 Next.js test mode。
- **你只需要配置简单的浏览器端缓存：** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) 通过一个 fixture 把响应缓存到磁盘上。
- **你的服务器不是用 JavaScript 编写的，或者你无法修改它的代码：** 像 mockttp 这样的正向代理通过 `HTTPS_PROXY` 工作。Playwright 团队的[文章](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)说 Python、Go、Ruby、Rust 和 .NET 的方式相同，Java 则需要 `-Dhttps.proxyHost` 和 `-Dhttps.proxyPort`。
- **你需要在 Playwright 之外、用任何语言进行录制与回放：** proxay 和 talkback 是独立的 HTTP 服务器，会把录制保存为 tape 文件。
