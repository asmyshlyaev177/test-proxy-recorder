---
title: 'Cách ghi lại và phát lại hoạt động: proxy cho SSR, HAR cho trình duyệt'
description: test-proxy-recorder ghi lại traffic qua hai cơ chế, một proxy cho các request phía máy chủ và HAR cho các request phía trình duyệt, dùng cùng nhau hoặc riêng lẻ.
sidebar:
  label: Cách thức hoạt động
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: e353fcc1cd381fbe245c50f6a5938f7d57ed21e3
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

Mỗi test đặt chế độ cho session của riêng nó khi bắt đầu, và mọi request đều mang id của test trong header `x-test-rcrd-id`, nên các test chạy cùng lúc giữ chế độ và file riêng của mình. Ở chế độ **ghi lại**, proxy chuyển tiếp tới backend thật và lưu các response vào file của test đó; ở chế độ **phát lại**, nó trả về các response đã lưu từ đĩa, lấy từ bản ghi của test đó; ở chế độ **transparent**, nó chuyển tiếp mà không ghi lại. Các phiên bản đến 2.0.1 giữ một session ghi lại duy nhất cho mọi request, nên một lần chạy ghi lại trên các phiên bản đó cần một worker. Proxy khởi động ở chế độ transparent, nên một ứng dụng chạy qua nó bên ngoài test vẫn giao tiếp với backend như bình thường. Xem [endpoint điều khiển](/vi/docs/guides/control-endpoint/) để biết cách chuyển đổi giữa các chế độ.

## Cách phát lại khớp request {#replay-matching}

Proxy và file HAR tra cứu một response đã ghi theo những cách khác nhau.

| Khi phát lại | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Khớp theo | Method, path, một hash MD5 của query string và body của request, bỏ qua boundary của multipart. `GET` và `HEAD` khớp mà không cần body. Header không được so sánh. | Method, URL và body, sau đó là các mục có nhiều header request trùng nhất, vì cùng một URL và body có thể là các thao tác khác nhau được phân biệt bằng một header. Body không có trong mục nào thì quay về khớp theo method và URL, và boundary của multipart được bỏ qua. |
| Cùng một request lặp lại | Bản ghi tiếp theo có cùng body, theo thứ tự đã ghi. | Bản ghi tiếp theo, theo thứ tự đã ghi, với một quy tắc cho các request thay đổi dữ liệu (xem bên dưới). |
| Không có bản ghi | Một 404 với body JSON nêu tên request, và `playwrightProxy.before()` đóng trang để test thất bại ngay lập tức (`failOnMissingRecording: false` tắt hành vi này). | Request bị hủy và dòng `[Client-Side Replay] No recorded response for <method> <url>` được ghi vào log. |
| Khi nào gọi tới API thật | Chỉ ở chế độ `transparent`. | Chỉ với các request không khớp `url`. |

### Request phía máy chủ (proxy)

Khóa (key) gồm method, path và 16 ký tự hex đầu tiên trong hash MD5 của query string. `GET /todos?page=2` có khóa `GET_todos_46589c7afd19c014.json`, nên một query string khác đi dù chỉ một chút, kể cả chỉ khác thứ tự tham số, sẽ tạo ra một khóa khác.

Các lời gọi có cùng khóa sau đó được khớp theo body của request, nên các lời gọi gửi song song, vốn tới proxy theo thứ tự khác nhau ở mỗi lần chạy, vẫn nhận đúng response của mình. Trước khi so sánh, proxy áp dụng việc loại bỏ trên body (`bodyPatterns`) cho cả hai body và bỏ boundary của multipart, nên một secret đã bị loại bỏ hoặc một boundary thay đổi theo từng request không làm hỏng việc khớp. Các lời gọi `GET` và `HEAD` chỉ được khớp theo khóa.

Một lời gọi có body mà không bản ghi nào có được xử lý như một request không có bản ghi (xem bên dưới), và lý do nêu rõ body: `No recording for POST /embeddings with this request body in session <id> (2 recorded with other bodies)`. Proxy không bao giờ trả lời nó bằng một bản ghi được tạo cho body khác, vì như vậy sẽ che giấu một thay đổi trong những gì ứng dụng đã gửi. Hãy giữ body giống nhau giữa các lần chạy: một ngày hiện tại hoặc một id ngẫu nhiên trong body sẽ làm phát lại thất bại.

Các lời gọi có cùng khóa và body được trả về theo thứ tự chúng được ghi lại. Một lời gọi vượt quá bản ghi cuối cùng có body đó sẽ nhận lại response của bản ghi đó, và proxy ghi log `[REPLAY WARNING] All N recordings matching this request already served for <key> (session: <id>), reusing last one`, trong đó N là số bản ghi có body đó.

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

Khi bạn truyền `url`, `playwrightProxy.before()` ghi lại các request trình duyệt khớp với nó bằng trình ghi HAR của Playwright:

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

Việc phát lại do handler `page.route()` riêng của thư viện đảm nhận trên file đó, không phải `page.routeFromHAR()`. Cơ chế phát lại của Playwright trả về mục (entry) khớp đầu tiên cho mọi lần lặp lại của một request ([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), nên một `GET` sau một `POST` hiển thị danh sách từ trước `POST`. Thay vào đó, handler trả mỗi bản ghi đúng một lần, theo thứ tự đã ghi, và chỉ dùng lại một bản ghi khi trang yêu cầu nhiều lần hơn lúc ghi lại. Một quy tắc sắp xếp các request đọc so với các request thay đổi dữ liệu. Khi một request thay đổi dữ liệu tới một path (bất kỳ method nào ngoài `GET`, `HEAD` và `OPTIONS`, nên một query GraphQL cũng được tính) đã được phát lại, request đọc tới path đó hoặc tới một path nằm dưới nó sẽ ưu tiên các bản sao được ghi sau request thay đổi dữ liệu đó. Một request đọc không còn bản sao nào trước request thay đổi dữ liệu kế tiếp thuộc loại này sẽ dùng lại bản sao mới nhất trước request đó. Quy tắc này giữ cho việc phát lại đúng khi ứng dụng đọc với số lần khác so với lúc ghi lại, chẳng hạn fetch hai lần trong strict mode của React. Một redirect đã ghi được đi theo ngay bên trong `.har`, vì request tiếp theo của trình duyệt không bao giờ tới được `page.route()`: một fetch nhận response cuối cùng, còn một navigation được chuyển tiếp tới đích của redirect.

Một request khớp `url` nhưng không có trong `.har` sẽ bị hủy. Các request không khớp `url` không bị chặn, và ở chế độ `transparent` thì không request nào bị chặn. Chúng đi ra mạng thật.

Request tới chính proxy (`localhost:8100`) là ngoại lệ. `before()` đăng ký handler riêng cho chúng sau handler HAR, và handler đăng ký sau sẽ được Playwright chạy trước. Handler đó chuyển tiếp chúng tới proxy, nơi phát lại chúng từ `.mock.json` giống như các request phía máy chủ.
