---
title: 'test-proxy-recorder so với MSW, routeFromHAR, Polly.js và chế độ test của Next.js'
description: 'So sánh test-proxy-recorder với MSW, routeFromHAR, Polly.js, chế độ test của Next.js, mockttp, Mocky Balboa, scenarist, talkback và proxay, kèm nguồn.'
sidebar:
  label: So sánh
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

Mỗi công cụ ở đây kiểm soát các response API mà một test end-to-end nhận được. Chúng khác nhau ở chỗ chặn request ở đâu (trong trình duyệt, bên trong máy chủ của bạn, hay trong một proxy riêng) và ở việc bạn tự viết response hay ghi lại chúng. Bảng giữ sáu công cụ từ [phần tổng quan của tài liệu](/vi/docs/#comparison) và bổ sung chế độ test của Next.js (Next.js test mode), mockttp, scenarist, talkback và proxay. Mỗi ô đều lấy từ tài liệu, README hoặc mã nguồn của chính công cụ đó, được liên kết bên dưới bảng, tính đến ngày 2026-10-03. "Không có trong tài liệu" nghĩa là các nguồn đó không đề cập.

## Bảng tính năng {#table}

| Công cụ | Ghi lại traffic thật | Phía máy chủ (SSR) | Phía trình duyệt | WebSocket | Thuần Playwright | Bản phát hành mới nhất |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Có | Có, qua proxy | Có, qua HAR | Có | Có | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Có | Không | Có | Không | Có sẵn | Playwright 1.63.0, 2026-09-04 |
| MSW | Không (handler, hoặc một HAR qua `@msw/source`) | Bên trong tiến trình máy chủ | Có | Có | `@msw/playwright`, request trình duyệt | 3.0.2, 2026-10-03 |
| Polly.js | Có | Bên trong tiến trình máy chủ | Có | Không có trong tài liệu | Adapter của bên thứ ba | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Có | Không | Có | Không có trong tài liệu | Có | 0.3.0, 2026-05-12 |
| Mocky Balboa | Không (handler) | Có | Có | Không có trong tài liệu | Có | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Chế độ test của Next.js | Không (handler) | Có, chỉ Next.js | Request tới các origin khác | Không có trong tài liệu | Có | Thử nghiệm, trong Next.js 16.3.8, 2026-09-30 |
| mockttp | Không có trong tài liệu | Có, dưới dạng proxy chuyển tiếp (forward proxy) | Có, dưới dạng proxy của trình duyệt | Có | Không, một fixture do bạn tự viết | 4.6.3, 2026-09-11 |
| scenarist | Không (kịch bản viết bằng mã) | Next.js và Express | Không | Không có trong tài liệu | Có | 0.5.1, 2026-09-27 |
| talkback | Có | Có, khi dùng làm địa chỉ của API | Không có trong tài liệu | Không có trong tài liệu | Không | 4.2.0, 2024-07-10 |
| proxay | Có | Có, khi dùng làm địa chỉ của API | Có, khi dùng làm địa chỉ của API | Không có trong tài liệu | Không | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## Nguồn và ghi chú {#sources}

Ngày phát hành lấy từ npm registry, trừ khi có liên kết tới một bản phát hành trên GitHub.

- **test-proxy-recorder.** Lời gọi phía máy chủ đi qua proxy và lời gọi trình duyệt đi qua HAR ([cách thức hoạt động](/vi/docs/getting-started/how-it-works/)). Các message WebSocket đã ghi được proxy phát lại ([CLI](/vi/docs/guides/cli/#websocket-replay-pacing)). Bản phát hành: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** Với `update: true`, nó ghi một HAR từ traffic thật ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). Khi phát lại, nó phục vụ "các request mạng được thực hiện trong trang" ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). Nó hoạt động qua các handler `route()` để fulfill request HTTP và không có nhánh xử lý nào cho WebSocket ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Bản phát hành: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** Bạn tự viết các request handler. Bản thân MSW không ghi lại gì, nhưng [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) có thể tạo handler từ một file HAR mà bạn xuất từ DevTools của trình duyệt. Trong Node.js, nó chạy bên trong tiến trình thực hiện các request ([`setupServer`](https://mswjs.io/guides/integrations/node)). WebSocket dùng [API `ws`](https://mswjs.io/docs/websocket). Binding chính thức [`@msw/playwright`](https://github.com/mswjs/playwright) định tuyến qua `page.route()`, nên nó bao phủ request trình duyệt. Bản phát hành: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** [Repository](https://github.com/Netflix/pollyjs) của nó mô tả nó là "ghi lại, phát lại và stub các tương tác HTTP". [Adapter node-http](https://netflix.github.io/pollyjs/#/adapters/node-http) patch các module `http` và `https` của Node, và [adapter fetch](https://netflix.github.io/pollyjs/#/adapters/fetch) bọc `fetch` toàn cục. Vì vậy Polly ghi lại bên trong tiến trình chạy nó. Tài liệu của nó không liệt kê adapter WebSocket nào. Hỗ trợ Playwright đến từ [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright) của bên thứ ba, được [tài liệu của Polly](https://netflix.github.io/pollyjs/#/adapters/playwright) liên kết tới. Bản phát hành: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** [README](https://github.com/vitalets/playwright-network-cache) của nó cho biết nó tăng tốc test Playwright "bằng cách cache các request mạng trên hệ thống file". `CacheRoute` chặn bằng `page.route()` ([mã nguồn](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), nên nó chỉ thấy request trình duyệt. Bản phát hành: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** Bạn định nghĩa mock trong test, cho cả request máy chủ lẫn request client qua một API duy nhất. Mock được cô lập theo từng test khi các test chạy song song ([tính năng](https://docs.mockybalboa.com/docs/features/)). Với Next.js 14 trở lên, CLI của nó khởi động máy chủ Next.js của bạn ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). Tài liệu của nó chỉ nhắc tới WebSocket như kênh giữa máy chủ của bạn và test runner. Bản phát hành: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Chế độ test của Next.js.** Các handler đăng ký bằng `next.onFetch()` nhận các lời gọi `fetch` của máy chủ, cộng thêm các lời gọi `fetch` của trang tới các origin khác ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). [Mock phía máy chủ](/vi/docs/guides/server-side-mocking/#nextjs-test-mode) trình bày cách thiết lập, trạng thái của nó và MSW 3. Bản phát hành: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** Một mock server và proxy cho HTTP và HTTPS, dành cho các test chạy "trong node hoặc trình duyệt" ([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()` mock các kết nối WebSocket ([mã nguồn](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). README không mô tả chế độ ghi lại nào. [Bài viết](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) của đội ngũ Playwright cho thấy fixture cần viết. Bản phát hành: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** [README](https://github.com/citypaul/scenarist) cho biết nó được "xây dựng trên MSW, với việc quản lý kịch bản lúc chạy và cô lập theo test ID", và bạn viết các kịch bản bằng mã. FAQ của nó cho biết nó "cung cấp việc quản lý kịch bản phía máy chủ, bổ sung cho việc mock phía client của Playwright". Mã máy chủ của bạn chuyển tiếp `x-scenarist-test-id` trên mỗi `fetch` ([adapter Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), và `@scenarist/playwright-helpers` cung cấp Playwright fixture. Bản phát hành: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** "Một HTTP proxy viết bằng javascript, ghi lại và phát lại các request HTTP" ([README](https://github.com/ijpiantanida/talkback)). Ứng dụng của bạn gửi request tới talkback. Một request khớp với một tape đã lưu sẽ nhận response của tape đó, còn một request chưa biết sẽ được chuyển tiếp tới host và được lưu thành một tape mới. README không nhắc tới trình duyệt, cũng không nhắc tới tape theo từng test. Bản phát hành: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** Một proxy ghi lại và phát lại cho "một web frontend và backend của nó" hoặc "một máy chủ và một máy chủ khác" ([README](https://github.com/airtasker/proxay)). Các test chọn tape bằng `POST /__proxay/tape`, chẳng hạn trong `beforeEach`, và README không đề cập tới test song song. Phiên bản 2.0.0 là một [bản phát hành trên GitHub](https://github.com/airtasker/proxay/releases/tag/v2.0.0); [npm](https://www.npmjs.com/package/proxay) vẫn phục vụ 1.9.0.

## Giải pháp thay thế Polly.js cho Playwright {#pollyjs}

Polly.js, của Netflix, ghi lại, phát lại và stub HTTP, và nó là nguồn cảm hứng cho test-proxy-recorder. Tình trạng của nó vào ngày 2026-10-03:

- `@pollyjs/core` không có bản phát hành nào kể từ 6.0.6 ngày 2023-07-20. Thay đổi cuối cùng của repository, vào ngày 2025-05-31, đã phát hành `@pollyjs/adapter-fetch` 6.0.7, bản gỡ bỏ việc đánh dấu deprecated của adapter fetch trên Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Polly không có adapter Playwright của riêng mình. Tài liệu của nó trỏ tới [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright) của bên thứ ba, gắn vào một browser context hoặc page. Bản phát hành cuối cùng của adapter này, 2.4.0, là vào ngày 2024-04-18.
- Với các lời gọi phía máy chủ, Polly phải chạy bên trong tiến trình máy chủ, qua adapter node-http hoặc fetch của nó.

Nếu bạn đang chuyển từ Polly.js sang, các khái niệm của nó tương ứng với test-proxy-recorder như sau.

| Polly.js | test-proxy-recorder |
| --- | --- |
| Các chế độ `record`, `replay` và `passthrough` ([cấu hình](https://netflix.github.io/pollyjs/#/configuration)) | Các chế độ `record`, `replay` và `transparent`, được đặt cho từng test bởi `playwrightProxy.before()` |
| Một bản ghi có tên cho mỗi instance Polly, được lưu bởi một persister | Một `.mock.json` (máy chủ) và một `.har` (trình duyệt) cho mỗi test Playwright, trong thư mục bản ghi |
| Các adapter bên trong tiến trình thực hiện request | Một tiến trình proxy cho lời gọi phía máy chủ, HAR cho lời gọi trình duyệt, và `registerProxyFetch()` trên máy chủ |
| Request được khớp theo method, header, body, thứ tự và URL theo mặc định | Request phía máy chủ được khớp theo method, path và một hash của query, theo thứ tự đã ghi, không so sánh body. Request trình duyệt theo quy tắc HAR của Playwright, vốn so sánh cả body của POST |

## MSW với Next.js và Playwright {#msw}

Trong một ứng dụng Next.js, request trình duyệt và request máy chủ cần các thiết lập MSW khác nhau.

- **Request trình duyệt.** [`@msw/playwright`](https://github.com/mswjs/playwright), binding chính thức, chạy các handler của bạn qua `page.route()`, với một fixture `network` mà bạn có thể thay đổi theo từng test.
- **Request máy chủ.** MSW chạy bên trong tiến trình Next.js. Tài liệu của MSW không có hướng dẫn cho Next.js, và ví dụ tham chiếu là một pull request đang mở, [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Các handler mà bạn thay đổi lúc chạy được dùng chung bởi mọi test gọi tới máy chủ đó. [Mock phía máy chủ](/vi/docs/guides/server-side-mocking/#msw) có đầy đủ chi tiết và nguồn.
- **Handler phía máy chủ theo từng test.** Chế độ test của Next.js nhận handler MSW theo từng test, nhưng entry point MSW của nó không tải được với MSW 3.0 ([chi tiết](/vi/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist xây dựng các kịch bản theo từng test trên nền MSW cho Next.js và Express, và mã máy chủ của bạn chuyển tiếp một header test id trên mỗi `fetch`.
- **Ghi lại.** MSW không ghi lại traffic. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) biến một file HAR, xuất từ DevTools của trình duyệt, thành các handler.

test-proxy-recorder chọn sự đánh đổi ngược lại. Nó ghi lại cả hai phía từ API thật, nên không có handler nào phải viết. Đổi lại, bạn ít kiểm soát hơn đối với những response mà API không tạo ra theo yêu cầu.

## Khi nào nên dùng thứ khác {#when-to-use-something-else}

- **Mọi traffic của bạn đều ở phía trình duyệt.** `routeFromHAR` có sẵn của Playwright không cần thêm dependency nào. Hãy bắt đầu từ đó, và thêm test-proxy-recorder khi xuất hiện request phía máy chủ.
- **Bạn muốn tự viết response bằng tay, hoặc ép các lỗi và trường hợp biên.** Handler của MSW phù hợp hơn cho việc đó, và MSW cũng chạy trong [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook) và [trình duyệt](https://mswjs.io/guides/integrations/browser), không chỉ trong Playwright. Với handler phía máy chủ theo từng test trong Playwright, hãy xem Mocky Balboa, scenarist hoặc chế độ test của Next.js.
- **Bạn chỉ cần cache phía trình duyệt với ít thiết lập.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) cache các response trên đĩa thông qua một fixture.
- **Máy chủ của bạn không viết bằng JavaScript, hoặc bạn không thể thay đổi mã của nó.** Một proxy chuyển tiếp như mockttp hoạt động thông qua `HTTPS_PROXY`. [Bài viết](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) của đội ngũ Playwright cho biết Python, Go, Ruby, Rust và .NET hoạt động theo cùng cách, còn Java cần `-Dhttps.proxyHost` và `-Dhttps.proxyPort`.
- **Bạn cần ghi lại và phát lại bên ngoài Playwright, với bất kỳ ngôn ngữ nào.** proxay và talkback là các HTTP server độc lập, lưu bản ghi dưới dạng file tape.
