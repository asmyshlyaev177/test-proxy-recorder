---
title: '在 Playwright 中 mock 服务端请求（Next.js、TanStack Start）'
description: '为什么 page.route() 捕获不到 Next.js 和 TanStack Start 中的服务端 fetch，以及在 Playwright 中如何用 test mode、MSW、mockttp 或录制的响应来处理它们。'
sidebar:
  label: 服务端 mock
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: 6fd6662395c2237b6c951527806be5bd6116dec1
---

在 Next.js 或 TanStack Start 应用中，服务器会在渲染页面时调用你的 API。Playwright 的请求 mock 永远看不到这些调用。下面各节先解释原因，再比较在 Playwright 测试中控制这些调用的四种方式：Next.js test mode、服务器内部的 MSW、mockttp 这类正向代理，以及用 test-proxy-recorder 录制真实响应。关于其他工具的事实已于 2026-10-03 对照它们自己的文档和源代码核实。

## 为什么 `page.route()` 看不到服务端请求 {#why}

Playwright 的 [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) 作用于“页面发出的网络请求”。而 Server Component、路由 loader 或 server function 运行在你应用的 Node.js 进程中。它的 `fetch` 从该进程直接发往 API。这个请求从不经过浏览器，所以 Playwright 没有可以拦截的东西。`page.route()` 确实能看到浏览器发给你应用的页面请求，以及返回的 HTML，但它永远看不到服务器为生成这段 HTML 而发出的请求。

HAR 文件也有同样的限制，因为 [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) 提供的是“页面中发出的网络请求”。

MSW 的[与 Playwright 的对比](https://mswjs.io/docs/comparison#playwright)也是这么说的：`page.route()` 影响的是“所启动浏览器中的流量，而不是 Node.js 进程”。Playwright 团队[关于服务端 mock 的文章](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)说 `page.route()` 适用于浏览器请求，而“对于服务端 HTTP 调用，它不起作用”。请求内置服务端 mock 的功能需求 [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766) 已于 2026-05-22 关闭，关闭时附上了那篇文章的链接。

## Next.js test mode {#nextjs-test-mode}

Next.js 在 `next/experimental/testmode/playwright` 提供了一个实验性的 Playwright 集成。它唯一的文档是 [Next.js 仓库中的一份 README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md)，[Next.js 的 Playwright 指南](https://nextjs.org/docs/app/guides/testing/playwright)没有提到它。测试用 `next.onFetch()` 注册 handler，Next.js 会把服务器的 `fetch` 调用交给这些 handler：

```typescript
// 根据 README 精简
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

它需要：

- `next.config.js` 中的 `experimental: { testProxy: true }`。
- 一个用 `next/experimental/testmode/playwright` 中的 `defineConfig` 构建的 `playwright.config.ts`，并且测试要从同一个模块导入 `test`。

在底层，每个 Playwright worker 都会启动一个小型代理服务器。fixture 会给页面的请求加上 `Next-Test-Proxy-Port` header（指向该代理）和 `Next-Test-Data` header（测试 id）（[`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)）。开启 `testProxy` 后，服务器读取这些 header，并把每个服务端 `fetch` 发往该代理。代理再把请求交给该测试的 handler（[`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)）。handler 按测试 id 分别保存，所以并行测试可以共用一个 Next.js 服务器。没有任何 handler 应答的服务端 fetch 会抛出 `Proxy request aborted`。handler 也可以返回 `'continue'`，让请求直接通过。`next.onFetch()` 还会收到页面自己发往其他源的 `fetch` 调用。

现状：

- 实验性。导入路径和配置键都表明了这一点，README 的标题也是“Experimental test mode for Playwright”。
- 它仍在接收修复。最近一次是 [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525)，于 2026-08-13 合并。
- README 还通过 `next/experimental/testmode/playwright/msw` 提供按测试使用的 MSW handler。在 MSW 3.0（2026-09-28 发布）下，这个入口无法加载。它导入了 `strict-event-emitter`，而 MSW 3.0 已不再依赖该包。它还调用了 MSW 的 `handleRequest()`，而 3.0 已移除该函数（[MSW 3.0 发布说明](https://github.com/mswjs/msw/releases/tag/v3.0.0)、[`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)）。在 MSW 2.15.0 下它可以加载。两个结果都基于 Next.js 16.3.8，于 2026-10-03 验证。

## Next.js 服务器中的 MSW {#msw}

MSW 在 Node.js 中用 `msw/node` 的 `setupServer` 拦截请求（[Node.js 集成](https://mswjs.io/guides/integrations/node)）。它的文档没有 Next.js 指南。MSW 的作者在关闭 App Router 相关的 issue 时，把 [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) 指定为集成参考（[评论](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)）。这个 pull request 自 2024-01-22 起一直处于打开状态。它在 root layout 中启动拦截器，并使用一份固定的 handler 列表：

```tsx
// app/layout.tsx，来自 mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

这样 handler 就位于 Next.js 进程中。该示例用 Playwright 的 `webServer` 启动这个进程，而 `webServer` 在整个运行期间只运行一个进程（[Playwright 团队的文章](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)）。每个 worker 都把它的页面请求发往这同一台服务器，而并行的 worker 会改变其 handler 的行为：

- 测试无法在那台服务器上调用 `server.use()`，因为测试运行在它自己的 worker 进程中。MSW 没有已发布的 API 可以修改另一个进程中的 handler。相关提案是 [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617) 中的 `setupRemoteServer`，自 2023-05-12 起一直处于打开状态。MSW 的 Playwright 绑定表示，在该功能发布之前，它依赖 `page.route()`（[`@msw/playwright`](https://github.com/mswjs/playwright)）。
- 如果你自己加一条通道，例如一个调用 `server.use()` 的 API 路由，改动就会影响到每个测试。用 [`server.use()`](https://mswjs.io/api/setup-server/use) 添加的 handler 会“保留在服务器实例上”。[server boundary 一文](https://mswjs.io/blog/introducing-server-boundary)解释说，同一台服务器上的并发覆盖会变成“所有测试共享的全局状态”。MSW 的作者在 #1617 中指出，实际做法要么是保持“一份固定的 handler 列表”，要么是“为每个测试用例启动一个应用实例”。

实际上，共享的 Next.js 服务器中的 MSW 会给每个并行测试返回相同的响应。有两个工具在 MSW 之上提供按测试划分的 handler。Next.js test mode 接受 MSW handler（需配合 MSW 2，见上文）。[scenarist](https://github.com/citypaul/scenarist) 按 `x-scenarist-test-id` header 区分场景，这个 header 由你的服务器代码在每个 `fetch` 上转发（[Next.js 适配器](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)）。

## mockttp 这类正向代理 {#mockttp}

Playwright 团队在关闭 #30766 时[指向了](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) Simon Knott 的[文章](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)。这篇文章把 [mockttp](https://github.com/httptoolkit/mockttp)（一个 HTTP 和 HTTPS 的 mock 服务器兼代理）放在服务器的出站流量前面。每个测试都向它添加规则，例如 `mocks.forPost(url).thenJson(200, body)`。

应用的代码不需要改动。它的服务器进程在启动时带上一些环境变量，让出站请求经过该代理：

- `HTTP_PROXY` 和 `HTTPS_PROXY` 设为代理的 URL。
- `NODE_USE_ENV_PROXY=1`，让 Node 内置的 `fetch` 使用这些变量。Node.js 在 24.0.0 和 22.21.0 中加入了它，并将其标记为处于积极开发阶段（[Node.js 文档](https://nodejs.org/api/cli.html#node_use_env_proxy1)）。
- `NODE_EXTRA_CA_CERTS` 指向代理的 CA 证书，让服务器信任 mockttp 为 HTTPS 主机生成的证书。

代理属于某一个 Playwright worker，所以这篇文章通过一个 worker fixture 为每个 worker 启动一台应用服务器，各自使用一个空闲端口。它没有使用 Playwright 的 `webServer`，因为 `webServer` 会在任何 worker 存在之前为整个运行启动一个进程。在文章的配置中，没有匹配规则的请求会透传到真实 API。文章建议改为用错误应答这些请求，这样遗漏的 mock 就会暴露出来。

Playwright 团队称这种方式“与服务器的语言和框架无关”。文章本身使用的是一个普通的 Node 服务器，而不是 Next.js 或 TanStack Start。

## 用 test-proxy-recorder 录制真实响应 {#test-proxy-recorder}

使用上面三种方式时，每个响应都要你自己编写。test-proxy-recorder 则在本地运行期间录制你的真实 API 返回的内容，然后在 CI 上回放。

- **代理：** 在测试运行时，在你的应用旁边启动 `test-proxy-recorder <target-url>`。设置了 `TEST_PROXY_RECORDER_ENABLED` 时，把应用的 API 基础 URL 指向它。每个代理只转发到一个后端，即启动它时指定的 `<target-url>`。
- **`registerProxyFetch()`：** 在服务器上调用一次，就会 patch 全局 `fetch`。它把当前请求的 `x-test-rcrd-id` header 复制到每个出站请求上。代理读取这个 header，把每个服务端调用归到对应的测试下。除非设置了 `TEST_PROXY_RECORDER_ENABLED`，否则这个调用在生产环境中是 no-op。
- **每个测试的 id：** `playwrightProxy.before(page, testInfo, mode)` 根据 spec 文件、其 `describe` 标题和测试标题生成会话 id。它把这个 id 作为 `x-test-rcrd-id` 附加到页面的请求上，并把该会话切换到 `record` 或 `replay`。并行的 worker 共用一台应用服务器和一个代理，而每个测试仍有自己的录制。

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

针对真实 API 录制一次，然后提交 `.mock.json`（服务端）和 `.har`（浏览器）文件。之后 CI 在后端关闭的情况下回放它们。回放时，没有录制的请求会得到一个指明该请求的 404，它永远不会到达 API。

录制的响应只涵盖录制期间 API 的实际行为。如果要强制返回 API 不会按需产生的错误或边界情况，用上面某种方式手写 handler 会更简单。

配置细节参见 [Next.js](/zh-cn/docs/integrations/nextjs/) 和 [TanStack Start](/zh-cn/docs/integrations/tanstack-start/) 指南。

## 方案对比 {#comparison}

| 方案 | 应用中的配置 | 并行测试 | handler 还是录制的响应 | Next.js 与 TanStack Start |
| --- | --- | --- | --- | --- |
| [Next.js test mode](#nextjs-test-mode) | `next.config.js` 中的 `experimental.testProxy` | 支持，handler 按测试分别保存 | handler（`next.onFetch()`，或 MSW 2 的 handler） | 仅限 Next.js |
| [服务器中的 MSW](#msw) | 在服务器代码中启动 `setupServer`（MSW 的示例中是在 root layout 中） | 该服务器上的所有测试共用一套 handler | handler | Next.js：一个仍处于打开状态的 pull request 中有示例。TanStack Start：文档未提及 |
| [mockttp](#mockttp) | 无需改代码。在服务器进程上设置代理变量和 CA 证书 | 支持，每个 worker 一台应用服务器 | handler。没有匹配规则的请求会透传 | 文档未提及。Playwright 团队称它与框架无关 |
| [test-proxy-recorder](#test-proxy-recorder) | 测试期间把 API 基础 URL 指向代理，再加上 `registerProxyFetch()` | 支持，共用一台应用服务器 | 从真实 API 录制 | 两者都有文档 |

[对比](/zh-cn/docs/reference/comparison/)一页涵盖了更多工具，包括 Mocky Balboa、scenarist、Polly.js、talkback 和 proxay，以及浏览器端的方案。
