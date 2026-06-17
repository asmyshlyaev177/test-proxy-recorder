---
title: 控制端点
description: 代理暴露 /__control，用于在 transparent、record 和 replay 之间以编程方式切换模式。
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
  mode: 'transparent' | 'record' | 'replay';
  id?: string;       // required for record/replay
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
}
```

在大多数配置中，你不会直接调用它 —— `playwrightProxy.before()` 和 `setProxyMode()`（参见 [API 参考](/docs/reference/api/readme/)）会替你发送 POST。当你从 shell、CI 步骤或 AI agent 驱动代理时，再使用 `/__control`。
