---
title: Next.js
description: 用 recording-session header 给 Next.js 服务端 fetch 打标，让 SSR 得以录制和回放 —— 通过 registerProxyFetch（推荐，任意 runtime）、axios 用 registerProxyAxios，或按调用用 createHeadersWithRecordingId。中间件是可选的。
---

Next.js 这样的 SSR 框架会发起不带浏览器上下文的服务端 `fetch` 调用，它们经过代理。代理通过 `x-test-rcrd-id` header 识别这些请求属于哪个会话。Playwright 的 `playwrightProxy.before()` 已经在触发 SSR 的浏览器导航上设置了它，所以 id 在 `next/headers` 里可取 —— 我们要做的是**把它附加到外发的服务端请求上**。（纯浏览器测试不需要这些；代理会回退到全局设置的会话。）

:::tip
[`test-proxy-recorder init`](/zh-cn/docs/getting-started/quick-start/) 会检测 Next.js，并自动把下面推荐的方式接入你的 root layout。
:::

:::caution[请针对 production build 录制]
请用 `next build && next start` 录制，而不是 `next dev`。开发服务器会在请求之间重置 global `fetch` 的 patch（[vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)），而且更慢、更不稳定。由于 `next start` 以 production 模式运行，请在 e2e 运行时给应用进程设置 `TEST_PROXY_RECORDER_ENABLED=true`。
:::

## registerProxyFetch（推荐）

在你的 **root layout** 中加一行，就能给每一个服务端 `fetch` 打标 —— Server Components、Route Handlers，在 Node **和** Edge runtime 上都有效：

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // production 下是 no-op，除非 TEST_PROXY_RECORDER_ENABLED=true
```

它会 patch global `fetch`，把当前请求的 `x-test-rcrd-id` 复制到外发请求上，这样代理就能区分并发的回放会话。请从 root layout 调用 —— **不要**放在 `instrumentation.ts`，它的上下文与 Edge runtime 上渲染你路由的上下文不同，放在那里的 patch 会悄悄地不触发。

## axios —— registerProxyAxios

如果你的服务端请求走 axios，请对每个 server-side 实例注册一次：

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

它会添加一个 request interceptor，给请求盖上 id（绝不触碰 global `fetch`），所以不受上述 dev-server 警告影响。production / 浏览器下是 no-op；对每个实例幂等；绝不覆盖调用方已设置的 id。

## 按调用 —— createHeadersWithRecordingId

免 patch，在 `next dev` 下也可用。用于单个 fetch，或当你不想 patch global `fetch` 时：

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## 中间件（可选）

调用 `setNextProxyHeaders` 的 `proxy.ts`（Next.js 16+，导出 `proxy`）或 `middleware.ts`（15 及更早，导出 `middleware`）能让 id 通过 `next/headers` 取到，但**不给外发 fetch 打标** —— 所以当你使用上面任意一个 helper 时并不需要它。仅当你已经拥有一个中间件（鉴权等）时才考虑它，并且仍要搭配一个 helper 来做打标：

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // 暴露 id；请搭配上面的 helper
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`test-proxy-recorder/nextjs` 辅助函数的完整签名请参见 [API 参考](/zh-cn/docs/reference/api/readme/)。完整、可运行的 Edge 项目见 [Edge runtime 示例](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge)。

## package.json 脚本

从脚本启动各服务，而不要从 `playwright.config.ts` 启动：

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

完整、可运行的项目见 [Next.js 16 示例](/zh-cn/docs/reference/examples/#nextjs-16)。
