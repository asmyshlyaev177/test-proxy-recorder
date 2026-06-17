---
title: 工作原理
description: test-proxy-recorder 通过两种机制录制流量 —— 用代理处理服务端请求，用 HAR 处理浏览器端请求。两者可以一起使用，也可以单独使用。
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

每种模式按测试会话设置。在 **record** 模式下，代理转发到真实后端并保存响应；在 **replay** 模式下，它从磁盘提供已保存的响应；在 **transparent** 模式下，它转发但不录制。模式如何切换请参见[控制端点](/zh-cn/docs/guides/control-endpoint/)。
