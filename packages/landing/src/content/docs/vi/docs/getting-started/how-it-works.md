---
title: 'Cách ghi lại và phát lại hoạt động: proxy cho SSR, HAR cho trình duyệt'
description: test-proxy-recorder ghi lại traffic qua hai cơ chế, một proxy cho các request phía máy chủ và HAR cho các request phía trình duyệt, dùng cùng nhau hoặc riêng lẻ.
sidebar:
  label: Cách thức hoạt động
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: f808b2bb0634754bcb63911e3e006c34c495fe06
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

Mỗi test đặt chế độ khi nó bắt đầu, và proxy giữ một chế độ duy nhất cho mọi request nó nhận được, nên các test chạy cùng lúc dùng chung chế độ đó. Ở chế độ **ghi lại**, proxy chuyển tiếp tới backend thật và lưu các response; ở chế độ **phát lại**, nó trả về các response đã lưu từ đĩa, và id của mỗi test chọn ra bản ghi của chính test đó; ở chế độ **transparent**, nó chuyển tiếp mà không ghi lại. Xem [endpoint điều khiển](/vi/docs/guides/control-endpoint/) để biết cách chuyển đổi giữa các chế độ.

## Cách phát lại khớp request {#replay-matching}

Proxy và file HAR tra cứu một response đã ghi theo những cách khác nhau.

| Khi phát lại | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Khớp theo | Method, path và một hash MD5 của query string. Body không được so sánh. | Method và URL, cộng thêm body nếu request là `POST` ([quy tắc của Playwright](https://playwright.dev/docs/mock#replaying-from-har)). |
| Cùng một request lặp lại | Bản ghi tiếp theo, theo thứ tự đã ghi. | Mục (entry) có nhiều header khớp nhất. Thứ tự ghi bị bỏ qua. |
| Không có bản ghi | Một 404 với body JSON nêu tên request. | Request bị hủy. |
| Khi nào gọi tới API thật | Chỉ ở chế độ `transparent`. | Chỉ với các request không khớp `url`. |

### Request phía máy chủ (proxy)

Khóa (key) gồm method, path và 16 ký tự hex đầu tiên trong hash MD5 của query string. `GET /todos?page=2` có khóa `GET_todos_46589c7afd19c014.json`, nên một query string khác đi dù chỉ một chút, kể cả chỉ khác thứ tự tham số, sẽ tạo ra một khóa khác.

Các lời gọi có cùng khóa được trả về theo thứ tự chúng được ghi lại. Một lời gọi vượt quá bản ghi cuối cùng sẽ nhận lại response cuối cùng, và proxy ghi log `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`.

Một request không có bản ghi sẽ không tới được API thật. Proxy ghi các dòng log `[REPLAY ERROR]` và trả lời bằng một 404:

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

Proxy chỉ gửi request tới backend thật ở chế độ `transparent`. Một lần chạy phát lại rơi vào chế độ đó theo hai cách: `playwrightProxy.teardown()` chạy trong khi các test vẫn đang chạy, hoặc timeout của session (mặc định 120000 ms) hết trước lời gọi `playwrightProxy.before()` tiếp theo. [FAQ](/vi/docs/reference/faq/#parallel-replay) giải thích cả hai trường hợp.

### Request trình duyệt (HAR)

Khi bạn truyền `url`, `playwrightProxy.before()` giao các request trình duyệt cho cơ chế định tuyến HAR của Playwright:

```typescript
await page.routeFromHAR(harPath, { url, update: mode === 'record', updateContent: 'embed' });
```

Tùy chọn `notFound` của Playwright mặc định là `'abort'`, nên khi phát lại, một request khớp `url` nhưng không có trong `.har` sẽ bị hủy. Các request không khớp `url` không bị chặn. Chúng đi ra mạng thật, ở cả chế độ ghi lại lẫn phát lại.

Request tới chính proxy (`localhost:8100`) là ngoại lệ. `before()` đăng ký handler riêng cho chúng sau handler HAR, và handler đăng ký sau sẽ được Playwright chạy trước. Handler đó chuyển tiếp chúng tới proxy, nơi phát lại chúng từ `.mock.json` giống như các request phía máy chủ.
