---
title: Endpoint điều khiển
description: Proxy cung cấp /__control để chuyển đổi chế độ theo lập trình giữa transparent, record, và replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 17fac3de2790301f1ba96f8b4db21a5f01c05d79
---

Proxy cung cấp `/__control` để chuyển đổi chế độ theo lập trình.

```bash
# Lấy trạng thái hiện tại
curl http://localhost:8100/__control

# Chuyển đổi chế độ
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // bắt buộc trừ khi cleanup là true
  id?: string;       // bắt buộc cho record/replay (và cho cleanup)
  timeout?: number;  // timeout tự reset tính bằng ms (mặc định: 120000)
  cleanup?: boolean; // khi true, dọn dẹp session thay vì chuyển chế độ
  websocket?: WebSocketReplayConfig; // ghi đè nhịp phát lại WebSocket theo từng session
}
```

Trong hầu hết các thiết lập, bạn không gọi trực tiếp endpoint này — `playwrightProxy.before()` và `setProxyMode()` (xem [tham chiếu API](/vi/docs/reference/api/readme/)) thay bạn POST tới nó. Dùng `/__control` khi điều khiển proxy từ shell, một bước CI, hoặc một AI agent.
