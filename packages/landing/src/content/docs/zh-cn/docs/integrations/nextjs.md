---
title: Next.js
description: 从 Next.js 的服务端 fetch 传播录制会话 header —— 通过中间件（推荐）或手动转发 header —— 让 SSR 请求得以录制和回放。
---

Next.js 这样的 SSR 框架会发起服务端 `fetch` 调用，它们不带浏览器上下文就经过代理。代理通过 `x-test-rcrd-id` header 识别这些请求属于哪个会话 —— 这与 `playwrightProxy.before()` 在浏览器 `page` 上设置的是同一个 header。该 header **仅在 SSR 时需要** —— 对纯浏览器测试，代理会自动回退到全局设置的会话。

要让 SSR 请求携带此 header，请使用以下方式之一。

## 中间件（推荐）

Next.js 16 使用 `proxy.ts` 作为中间件入口（导出的函数命名为 `proxy`）。把它放在项目根目录，与 `next.config.ts` 并列：

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

:::note[Next.js 15 及更早]
入口是 `middleware.ts`，函数名为 `middleware` —— 其余完全相同：

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}
```
:::

## 手动转发 header

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

`test-proxy-recorder/nextjs` 辅助函数的完整签名请参见 [API 参考](/docs/reference/api/readme/)。

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
