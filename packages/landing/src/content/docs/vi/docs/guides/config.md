---
title: File cấu hình
description: Đặt các tùy chọn của test-proxy-recorder — target, port, regex loại bỏ bí mật, nhịp WebSocket — vào một file cấu hình được tự động phát hiện thay vì dùng cờ CLI.
i18nSource: docs/guides/config.md
i18nSourceBlob: d633335aa6541254ec9f1af34ca98d1ee4b6d758
---

Với bất cứ thứ gì vượt quá vài cờ — đặc biệt là các regex loại bỏ trong body — hãy đặt các tùy chọn vào file cấu hình thay vì cờ CLI. Proxy tự động phát hiện `test-proxy-recorder.config.{ts,js,mjs,cjs}` trong thư mục hiện tại, hoặc truyền `--config <path>` để trỏ tới một file cụ thể. Các file `.ts` hoạt động ngay không cần cấu hình.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // Việc loại bỏ bí mật bật theo mặc định; đối tượng này tùy chỉnh nó (dùng `redaction: false` để tắt).
  redaction: {
    headers: ['x-api-key'],         // các header bổ sung, gộp với các mặc định
    bodyPatterns: [/sk_live_\w+/g], // literal RegExp thật — không cần escaping trong CLI
    allowCookies: ['theme'],        // giữ các cookie này không bị loại bỏ
  },
  websocket: {
    timing: 'burst',                // 'burst' (mặc định) hoặc 'original' (tái lập nhịp)
  },
});
```

```bash
test-proxy-recorder                 # mọi tùy chọn từ file cấu hình
test-proxy-recorder --port 9000     # file cấu hình, nhưng port từ CLI thắng
```

## Độ ưu tiên

Mỗi tùy chọn được xác định theo thứ tự **cờ CLI → file cấu hình → mặc định có sẵn**. Một cờ bạn truyền trên dòng lệnh luôn ghi đè file cấu hình; bất cứ thứ gì bạn bỏ qua sẽ rơi về cấu hình, rồi mặc định. (Các cờ dạng danh sách như `--redact-headers` *thay thế* danh sách trong cấu hình thay vì gộp lại — chỉ truyền nó khi bạn muốn ghi đè.) `target` có thể được cho dưới dạng đối số CLI hoặc dạng `target` trong cấu hình; đối số thắng khi cả hai đều xuất hiện.

Xem [tham chiếu API](/vi/docs/reference/api/interfaces/config/) để biết kiểu `Config` đầy đủ.
