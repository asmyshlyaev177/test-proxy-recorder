---
title: CLI
description: Giao diện dòng lệnh của test-proxy-recorder — các tùy chọn, nhịp phát lại WebSocket, và cách reset một proxy bị kẹt.
i18nSource: docs/guides/cli.md
i18nSourceBlob: 354b4fe6118719c0fdbfe91d37a9c3db2ab33bd7
---

```bash
test-proxy-recorder <target-url> [options]
```

| Tùy chọn         | Mặc định       | Mô tả                              |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(bắt buộc)*   | URL backend cần proxy               |
| `--port, -p`     | `8000`         | Cổng lắng nghe của proxy            |
| `--dir, -d`      | `./recordings` | Thư mục chứa các file bản ghi       |
| `--timeout, -t`  | `120000`       | Thời gian timeout tự reset session (ms) |
| `--config, -c`   | *(tự động)*    | Đường dẫn tới file cấu hình         |
| `--ws-timing`    | `burst`        | Nhịp phát lại WebSocket — `burst` hoặc `original` |

Việc loại bỏ bí mật **bật theo mặc định** — Authorization/Cookie/Set-Cookie bị loại bỏ khỏi các bản ghi một cách tự động. Tắt nó bằng `--no-redact`, hoặc `redaction: false` trong [cấu hình](/vi/docs/guides/config/). Xem [loại bỏ bí mật](/vi/docs/guides/secret-redaction/) để biết các cờ `--redact-headers` và `--redact-body` bổ sung thêm vào những gì bị loại bỏ.

```bash
# Ví dụ
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## Nhịp phát lại WebSocket

Theo mặc định, các message WebSocket từ máy chủ đã ghi được phát lại theo kiểu **burst** khi kết nối — nhanh nhất và hoàn toàn tất định, lý tưởng cho CI. Truyền `--ws-timing original` (hoặc `websocket: { timing: 'original' }` trong cấu hình) để thay vào đó tái lập nhịp dựa trên timestamp đã ghi, sao cho các message đến với đúng khoảng cách thực giữa chúng; một test khi đó sẽ mất khoảng thời gian thực tương ứng với bản ghi.

Bạn cũng có thể đặt điều này **theo từng test** qua `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, điều này ghi đè mặc định ở cấp proxy chỉ cho phiên đó.

## Reset một proxy bị kẹt

Proxy tự trở về `transparent` sau khi mỗi session hết timeout, và `globalTeardown` reset nó vào cuối một lần chạy sạch. Nhưng một lần chạy bị **gián đoạn** (`Ctrl+C`), một phiên UI/debug, hoặc một cấu hình không có `globalTeardown` có thể khiến proxy dùng chung bị kẹt ở `record`/`replay` — khiến ứng dụng của bạn cứ trả về các response đã ghi thay vì gọi backend thật. Reset nó theo yêu cầu:

```bash
test-proxy-recorder reset    # hoặc: npm run proxy:reset
```

Lệnh này POST `{ "mode": "transparent" }` tới `/__control` — giải pháp thay thế được hỗ trợ và an toàn khi chạy song song thay vì reset thủ công bằng `curl`. An toàn khi chạy bất cứ lúc nào: một proxy không thể truy cập được xem như no-op. Cổng được xác định theo thứ tự **cờ `--port` → biến env `TEST_PROXY_RECORDER_PORT` → file cấu hình → `8000`**, nên nó nhắm đúng cổng mà proxy đã khởi động (truyền `--port` / `--config` để ghi đè). `init` dựng sẵn cái này dưới dạng script `proxy:reset`.

## `init` — dựng sẵn thiết lập

Xem [bắt đầu nhanh](/vi/docs/getting-started/quick-start/) để biết cách thiết lập một lệnh duy nhất được khuyến nghị với `npx test-proxy-recorder init`.
