---
title: TanStack Start
description: 面向 TanStack Start 的一流集成已在路线图中。在它发布之前，请从 server functions 手动传播录制会话 header。
---

:::caution[在路线图中]
一流的 `test-proxy-recorder/tanstack-start` 适配器已在计划中，但尚未发布。本页描述当下可用的手动方式，待适配器发布后将替换为专门指南。想更早用上？[提个 issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues)。
:::

TanStack Start 在服务端运行 loader 和 server functions，所以它们的 `fetch` 调用不带浏览器上下文就经过代理 —— 与 [Next.js SSR](/zh-cn/docs/integrations/nextjs/) 情况相同。代理需要这些服务端请求上的 `x-test-rcrd-id` header，才能把它们归属到正确的录制会话。

## 手动方式（当下可用）

`playwrightProxy.before()` 在浏览器 `page` 上设置的 header 会到达服务端的入站请求。在那里读取它，并在任何服务端 `fetch` 上转发：

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

与[手动配置](/zh-cn/docs/getting-started/manual-setup/)完全一样，仅在开发/测试中把后端基础 URL 指向代理（`http://localhost:8100`）。浏览器端请求仍由 `playwrightProxy.before()` 的 HAR 机制处理。

适配器发布后，这将简化为一个辅助函数的 import —— 在[路线图](https://github.com/asmyshlyaev177/test-proxy-recorder#readme)上跟踪进展。
