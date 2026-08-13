---
title: Cách thức hoạt động
description: test-proxy-recorder ghi lại traffic qua hai cơ chế — một proxy cho các request phía máy chủ và HAR cho các request phía trình duyệt. Dùng chúng cùng nhau hoặc độc lập.
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: c82c75cbf1d14fc641da1da4d85b7713c5e612db
---

test-proxy-recorder hỗ trợ hai cơ chế ghi lại tùy theo nơi request của bạn xuất phát. Cả hai có thể dùng cùng nhau hoặc độc lập.

| Cơ chế | Nội dung nó ghi lại | Trường hợp sử dụng |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Các request phía máy chủ (các fetch SSR từ Next.js, v.v.) | Các ứng dụng full-stack nơi máy chủ gọi API |
| **HAR** (`.har`) | Các request phía trình duyệt (`fetch` của trình duyệt, extension, SPA) | SPA, extension Chrome, API bên thứ ba |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Mỗi chế độ được đặt theo từng phiên test. Ở chế độ **ghi lại**, proxy chuyển tiếp tới backend thật và lưu các response; ở chế độ **phát lại**, nó trả về các response đã lưu từ đĩa; ở chế độ **transparent**, nó chuyển tiếp mà không ghi lại. Xem [endpoint điều khiển](/vi/docs/guides/control-endpoint/) để biết cách chuyển đổi giữa các chế độ.
