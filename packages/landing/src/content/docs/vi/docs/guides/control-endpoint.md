---
title: Endpoint điều khiển
description: Proxy cung cấp /__control để chuyển đổi chế độ theo lập trình giữa transparent, record, và replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
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
  cleanup?: boolean; // khi true, lưu và đóng session của id này thay vì chuyển chế độ
  websocket?: WebSocketReplayConfig; // ghi đè nhịp phát lại WebSocket theo từng session
}
```

Trong hầu hết các thiết lập, bạn không gọi trực tiếp endpoint này — `playwrightProxy.before()` và `setProxyMode()` (xem [tham chiếu API](/vi/docs/reference/api/readme/)) thay bạn POST tới nó. Dùng `/__control` khi điều khiển proxy từ shell, một bước CI, hoặc một AI agent.

## Các session

Proxy giữ một session cho mỗi id của test, ở chế độ ghi lại cũng như ở chế độ phát lại, nên các test trên các worker song song dùng chung một proxy. Mỗi request được đưa vào session có tên trong header `x-test-rcrd-id` của nó, hoặc trong cookie `proxy-recording-id` khi trình duyệt bắt tay (handshake) WebSocket. Các phiên bản đến 2.0.1 giữ một session ghi lại duy nhất cho mọi request.

- **`{"mode": "record", "id": "my-test-1"}`** bắt đầu ghi lại session đó. Các session đang ghi lại vẫn tiếp tục ghi.
- **`{"id": "my-test-1", "cleanup": true}`** chỉ tác động lên session đó. Một session phát lại sẽ đóng lại. Một session đang ghi lại được lưu vào file `.mock.json` của nó và tiếp tục ghi các request mang tên nó cho tới khi chuyển sang `transparent`, nên một request đến muộn từ test đó cũng được lưu.
- **`{"mode": "transparent"}`** lưu và kết thúc mọi session, nên mọi request đi thẳng tới đích. `playwrightProxy.teardown()` gửi lệnh này. Bộ hẹn giờ chế độ cũng làm điều tương tự khi `timeout` hết, và mỗi lần chuyển chế độ đều khởi động lại bộ hẹn giờ.

Một request không nêu tên session nào sẽ đi vào session duy nhất đang chạy. Khi có nhiều session đang chạy, proxy trả lời nó bằng một 400, ở chế độ ghi lại cũng như phát lại, và body liệt kê các id đang chạy trong `activeSessions`. Khi không có session nào đang chạy, request đi theo lần chuyển chế độ gần nhất.

## Trạng thái hiện tại

`GET /__control` trả về:

- `recordingsDir`, thư mục mà các bản ghi được ghi vào.
- `mode` và `id`, từ lần chuyển chế độ gần nhất.
- `redaction`, cấu hình [loại bỏ](/vi/docs/guides/secret-redaction/), hoặc `false` khi việc loại bỏ bị tắt. `playwrightProxy.teardown()` đọc nó để loại bỏ bí mật khỏi các file `.har`.
- `sessions`, các id đang ghi lại lúc này.
