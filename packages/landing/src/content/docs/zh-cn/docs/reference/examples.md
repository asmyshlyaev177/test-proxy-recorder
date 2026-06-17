---
title: 示例应用
description: test-proxy-recorder 的完整可运行示例 —— Next.js SSR、Chrome 扩展、第三方 WebSocket 行情，以及无后端回放的认证应用。
---

完整可运行的示例位于 [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) —— 每种录制机制一个。每个示例都有自己的 README，包含完整配置和录制/回放工作流。

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) —— 一个带 mock 后端、代理和 Playwright e2e 测试的 Next.js 16 待办应用。同时录制 SSR fetch（`.mock.json`）和浏览器 fetch（`.har`），并包含一个针对本地后端的 WebSocket 聊天。参见其 [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md)。

## Chrome 扩展 {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) —— 一个真实的 Chrome 扩展，从 content script 调用 X/Twitter 的 API；浏览器请求被录制到 `.har` 并离线回放，CI 上无需在线 API 或账号。参见其 [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md)。

## 加密货币行情 —— 第三方 WebSocket {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) —— 一个由 Binance 公开 WebSocket 源驱动的实时 BTC-USD 价格行情。通过代理把真实数据流录制一次，随后在 CI 上回放确定性的价格，无需网络或交易所账号。参见其 [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md)。

## 认证应用 {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) —— 一个登录**真实 AWS Cognito** 用户池的 Next.js 应用，随后录制/回放其受保护的 API。登录在每次运行时都保持在线（绝不录制）；受保护的数据在后端关闭的情况下回放，认证 token 会从录制中被涂抹。该集成只是寥寥几个文件 —— 参见其 [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md)。若想要**无需云账号**的相同模式，参见 [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock)。
