---
title: 控制端点
description: 代理暴露 /__control，用于在 transparent、record 和 replay 之间以编程方式切换模式。
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

代理暴露 `/__control`，用于以编程方式切换模式。

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // required unless cleanup is true
  id?: string;       // required for record/replay (and for cleanup)
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

在大多数配置中，你不会直接调用它 —— `playwrightProxy.before()` 和 `setProxyMode()`（参见 [API 参考](/docs/reference/api/readme/)）会替你发送 POST。当你从 shell、CI 步骤或 AI agent 驱动代理时，再使用 `/__control`。

## 会话

代理为每个测试 id 保留一个会话，record 模式与 replay 模式都是如此，所以并行 worker 上的测试可以共用一个代理。每个请求进入其 `x-test-rcrd-id` header 所指定的会话；浏览器的 WebSocket 握手则进入 `proxy-recording-id` cookie 所指定的会话。2.0.1 及更早的版本对所有请求只保留一个录制会话。

- **`{"mode": "record", "id": "my-test-1"}`** 开始录制该会话。已在录制的会话会继续录制。
- **`{"id": "my-test-1", "cleanup": true}`** 只作用于该会话。replay 会话会关闭。录制中的会话会被保存到它的 `.mock.json`，并继续录制指定它的请求，直到切换到 `transparent`，因此该测试迟到的请求也会被保存。
- **`{"mode": "transparent"}`** 保存并结束所有会话，于是每个请求都会透传到目标。`playwrightProxy.teardown()` 会发送它。`timeout` 耗尽时，模式计时器也会这样做，而每次切换都会重启该计时器。

没有指定会话的请求会进入唯一正在运行的会话。当有多个会话在运行时，无论 record 还是 replay，代理都会以 400 应答它，响应体在 `activeSessions` 中列出正在运行的 id。当没有会话在运行时，该请求遵循最后一次切换。

## 当前状态

`GET /__control` 返回：

- `recordingsDir`：录制写入的目录。
- `mode` 和 `id`：来自最后一次切换。
- `redaction`：[涂抹](/zh-cn/docs/guides/secret-redaction/)配置；涂抹关闭时为 `false`。`playwrightProxy.teardown()` 读取它来涂抹 `.har` 文件。
- `sessions`：当前正在录制的 id。
