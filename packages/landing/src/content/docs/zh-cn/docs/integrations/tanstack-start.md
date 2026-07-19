---
title: TanStack Start
description: 用录制会话 header 标记 TanStack Start 的服务端 fetch，从而录制并回放 SSR —— 通过 registerProxyFetch（推荐）或按调用使用 createHeadersWithRecordingId。
---

TanStack Start 在服务端运行 loader 和 server functions，所以它们的 `fetch` 调用不带浏览器上下文就经过代理 —— 与 [Next.js SSR](/zh-cn/docs/integrations/nextjs/) 情况相同。代理通过 `x-test-rcrd-id` header 识别这些请求属于哪个会话。Playwright 的 `playwrightProxy.before()` 已经在触发 SSR 的浏览器导航上设置了它，所以这个 id 会随入站的服务端请求到达 —— 要做的就是**把它附加到出站的服务端请求上**。（纯浏览器测试无需这些；代理会回退到全局设置的会话。）

:::caution[针对生产构建录制]
请用 `vite build` + `node .output/server/index.mjs`（即 `pnpm start`）录制，而不是 `vite dev`。开发服务器的每请求上下文与 `registerProxyFetch()` 所修补的生产运行时不同。由于生产服务器以生产模式运行，请在 e2e 运行时给应用进程设置 `TEST_PROXY_RECORDER_ENABLED=true`。
:::

## registerProxyFetch（推荐）

在你的 **router 设置**中加一行，即可标记每一个服务端 `fetch` —— 路由 loader、server functions 以及 server routes：

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // 在客户端 / 生产环境中为空操作，除非设置 TEST_PROXY_RECORDER_ENABLED=true
```

它会修补全局 `fetch`，把当前请求的 `x-test-rcrd-id` 复制到出站请求上，该值读取自 TanStack Start 的服务端请求上下文（`getRequestHeader`）。把它放在 `src/router.tsx` 顶部 —— 该模块会在每个 SSR 请求中于服务端运行；此调用是幂等的、在客户端为空操作、在生产环境中除非显式启用录制器否则也为空操作。

## 按调用 —— createHeadersWithRecordingId

无需修补。用于 loader 或 server function 中的单次 fetch，或者当你不想修补全局 `fetch` 时：

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

如果你想自行转发原始 id（或 `null`），还导出了 `getRecordingId()`。两者都从服务端上下文读取当前请求的 id，且在生产环境中除非设置 `TEST_PROXY_RECORDER_ENABLED=true` 否则均为空操作。

## 把应用指向代理

在开发/测试中，把你的后端基础 URL 指向代理，从而**两个**来源都被录制 —— 服务端基础 URL（由 loader / server functions 读取，例如 `BACKEND_URL`）和在构建时注入的浏览器端基础 URL（`VITE_API_URL`）。在生产中，把它们指向真实后端。浏览器端请求由 `playwrightProxy.before()` 的 HAR 机制处理，与[手动配置](/zh-cn/docs/getting-started/manual-setup/)完全一样。

## 完整示例

一个完整、可运行的应用 —— 基于 **TanStack Query** 构建（SSR 预取 + `useMutation`），涵盖 todos（浏览器 + SSR）、一个基于缓存 header 的 ISR 路由、一个脱敏用例，以及 WebSocket 聊天，全部可录制并回放 —— 位于 [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start)。它表明录制器对你的数据层是透明的：`registerProxyFetch()` 会在 SSR 期间标记 Query 的 `queryFn` fetch，无需任何 Query 专属代码。
