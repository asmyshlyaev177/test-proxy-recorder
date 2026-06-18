---
title: React Router / Remix
description: 面向 React Router 7（framework mode）和 Remix 的一流集成已在路线图中。在它发布之前，请从 loader 和 action 手动转发录制会话 header。
---

:::caution[在路线图中]
面向 React Router 7 framework mode（如今「Remix」的实际含义）的一流适配器已在计划中，但尚未发布。本页描述当下可用的手动方式，待适配器发布后将替换为专门指南。想更早用上？[提个 issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues)。
:::

React Router 7 的 loader 和 action 在服务端运行，所以它们的 `fetch` 调用不带浏览器上下文就经过代理 —— 与 [Next.js SSR](/zh-cn/docs/integrations/nextjs/) 情况相同。代理需要这些服务端请求上的 `x-test-rcrd-id` header，才能把它们归属到正确的录制会话。

## 手动方式（当下可用）

每个 loader/action 都会收到入站的 `request`。从它上面读取录制 ID 的 header，并在任何服务端 `fetch` 上转发：

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

与[手动配置](/zh-cn/docs/getting-started/manual-setup/)完全一样，仅在开发/测试中把后端基础 URL 指向代理（`http://localhost:8100`）。浏览器端请求仍由 `playwrightProxy.before()` 的 HAR 机制处理。

适配器发布后，这将简化为一个辅助函数的 import —— 在[路线图](https://github.com/asmyshlyaev177/test-proxy-recorder#readme)上跟踪进展。
