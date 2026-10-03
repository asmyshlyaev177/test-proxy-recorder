---
title: 'Mock request phía máy chủ trong Playwright (Next.js, TanStack Start)'
description: 'Vì sao page.route() bỏ sót các fetch phía máy chủ trong Next.js và TanStack Start, và cách chế độ test của Next.js, MSW, mockttp hoặc response đã ghi xử lý chúng trong Playwright.'
sidebar:
  label: Mock phía máy chủ
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: f5b4c780da98c479c1bc9c0491d2ae9747da5b85
---

Trong một ứng dụng Next.js hoặc TanStack Start, máy chủ gọi API của bạn trong lúc render một trang. Cơ chế mock request của Playwright không bao giờ thấy các lời gọi đó. Các phần bên dưới giải thích vì sao, rồi so sánh bốn cách kiểm soát chúng trong một test Playwright: chế độ test của Next.js (Next.js test mode), MSW bên trong máy chủ, một proxy chuyển tiếp (forward proxy) như mockttp, và ghi lại response thật bằng test-proxy-recorder. Thông tin về các công cụ khác đã được đối chiếu với tài liệu và mã nguồn của chính chúng vào ngày 2026-10-03.

## Vì sao `page.route()` không thấy request phía máy chủ {#why}

[`page.route()`](https://playwright.dev/docs/api/class-page#page-route) của Playwright hoạt động trên "các request mạng do một trang thực hiện". Trong khi đó, một Server Component, một route loader hay một server function lại chạy trong tiến trình Node.js của ứng dụng bạn. `fetch` của nó đi thẳng từ tiến trình đó tới API. Request không bao giờ đi qua trình duyệt, nên Playwright không có gì để chặn. `page.route()` có thấy request trang mà trình duyệt gửi tới ứng dụng của bạn, cùng HTML trả về. Nó không bao giờ thấy các request mà máy chủ đã gửi để dựng HTML đó.

File HAR cũng có cùng giới hạn này, vì [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) phục vụ "các request mạng được thực hiện trong trang".

[Bản so sánh với Playwright](https://mswjs.io/docs/comparison#playwright) của MSW cũng nói như vậy: `page.route()` ảnh hưởng tới "traffic trong trình duyệt được khởi chạy, không phải tiến trình Node.js". [Bài viết về mock phía máy chủ](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) của đội ngũ Playwright nói rằng `page.route()` hoạt động với request trình duyệt, và "Với các lời gọi HTTP phía máy chủ thì không." Yêu cầu tính năng tích hợp sẵn việc mock phía máy chủ, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), đã được đóng vào ngày 2026-05-22 kèm một liên kết tới bài viết đó.

## Chế độ test của Next.js {#nextjs-test-mode}

Next.js đi kèm một tích hợp Playwright thử nghiệm tại `next/experimental/testmode/playwright`. Tài liệu duy nhất của nó là một [README trong repository Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), và [hướng dẫn Playwright của Next.js](https://nextjs.org/docs/app/guides/testing/playwright) không nhắc tới nó. Một test đăng ký các handler bằng `next.onFetch()`, và Next.js gửi các lời gọi `fetch` của máy chủ tới các handler đó:

```typescript
// Rút gọn từ README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

Những gì nó cần:

- `experimental: { testProxy: true }` trong `next.config.js`.
- Một `playwright.config.ts` được tạo bằng `defineConfig` từ `next/experimental/testmode/playwright`, và các test import `test` từ cùng module đó.

Bên dưới, mỗi worker Playwright khởi động một proxy server nhỏ. Fixture thêm header `Next-Test-Proxy-Port` (proxy đó) và header `Next-Test-Data` (id của test) vào các request của trang ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). Khi `testProxy` được bật, máy chủ đọc các header đó và gửi mỗi `fetch` phía máy chủ tới proxy đó. Proxy giao request cho các handler của test tương ứng ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Các handler được giữ theo id của test, nên các test song song có thể dùng chung một máy chủ Next.js. Một fetch phía máy chủ mà không handler nào trả lời sẽ ném lỗi `Proxy request aborted`. Thay vào đó, một handler có thể trả về `'continue'` để cho request đi tiếp. `next.onFetch()` cũng nhận các lời gọi `fetch` của chính trang tới các origin khác.

Trạng thái:

- Thử nghiệm. Cả đường dẫn import lẫn khóa cấu hình đều nói vậy, và README có tiêu đề "Experimental test mode for Playwright".
- Nó vẫn nhận được các bản sửa lỗi. Bản mới nhất, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), được merge vào ngày 2026-08-13.
- README cũng cung cấp handler MSW theo từng test qua `next/experimental/testmode/playwright/msw`. Với MSW 3.0 (phát hành ngày 2026-09-28), entry point đó không tải được. Nó import `strict-event-emitter`, thứ mà MSW 3.0 không còn phụ thuộc nữa. Nó cũng gọi `handleRequest()` của MSW, hàm đã bị gỡ bỏ trong 3.0 ([ghi chú phát hành MSW 3.0](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). Nó tải được với MSW 2.15.0. Cả hai kết quả đều từ Next.js 16.3.8, kiểm tra vào ngày 2026-10-03.

## MSW trong máy chủ Next.js {#msw}

MSW chặn request trong Node.js bằng `setupServer` từ `msw/node` ([tích hợp Node.js](https://mswjs.io/guides/integrations/node)). Tài liệu của nó không có hướng dẫn cho Next.js. Khi đóng issue về App Router, tác giả MSW đã chỉ định [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) làm tài liệu tham chiếu cho việc tích hợp ([bình luận](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). Pull request đó vẫn đang mở kể từ ngày 2024-01-22. Nó khởi động interceptor từ root layout, với một danh sách handler cố định:

```tsx
// app/layout.tsx, từ mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

Khi đó các handler nằm trong tiến trình Next.js. Ví dụ này khởi động tiến trình đó bằng `webServer` của Playwright, thứ chạy một tiến trình duy nhất cho cả lần chạy ([bài viết của đội ngũ Playwright](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Mọi worker đều gửi các trang của mình tới máy chủ duy nhất đó, và việc có nhiều worker song song làm thay đổi cách các handler của nó hoạt động:

- Một test không thể gọi `server.use()` trên máy chủ đó, vì test chạy trong tiến trình worker riêng của nó. MSW chưa có API nào được phát hành để thay đổi handler trong một tiến trình khác. Đề xuất cho việc này, `setupRemoteServer` trong [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617), vẫn đang mở kể từ ngày 2023-05-12. Binding Playwright của MSW cho biết nó dựa vào `page.route()` cho tới khi tính năng đó được phát hành ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- Nếu bạn tự thêm một kênh riêng, chẳng hạn một API route gọi `server.use()`, thay đổi đó sẽ tới mọi test. Các handler được thêm bằng [`server.use()`](https://mswjs.io/api/setup-server/use) "tồn tại lâu dài trên instance của server". [Bài viết về server boundary](https://mswjs.io/blog/introducing-server-boundary) giải thích rằng các override đồng thời trên một server trở thành "một trạng thái toàn cục được chia sẻ giữa mọi test". Trong #1617, tác giả MSW lưu ý rằng trên thực tế bạn hoặc giữ "một danh sách handler cố định", hoặc khởi động "một instance ứng dụng cho mỗi test case".

Trên thực tế, MSW bên trong một máy chủ Next.js dùng chung sẽ trả cùng các response cho mọi test song song. Có hai công cụ bổ sung handler theo từng test trên nền MSW. Chế độ test của Next.js chấp nhận handler MSW (với MSW 2, xem ở trên). [scenarist](https://github.com/citypaul/scenarist) phân biệt các kịch bản (scenario) theo header `x-scenarist-test-id` mà mã máy chủ của bạn chuyển tiếp trên mỗi `fetch` ([adapter Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## Một proxy chuyển tiếp như mockttp {#mockttp}

Khi đóng #30766, đội ngũ Playwright đã [trỏ](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) tới [bài viết](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) của Simon Knott. Bài viết đặt [mockttp](https://github.com/httptoolkit/mockttp), một mock server và proxy cho HTTP và HTTPS, chắn trước traffic đi ra từ máy chủ. Mỗi test thêm các quy tắc (rule) vào nó, chẳng hạn `mocks.forPost(url).thenJson(200, body)`.

Mã của ứng dụng không thay đổi. Tiến trình máy chủ của nó khởi động với các biến môi trường đưa các request đi ra qua proxy:

- `HTTP_PROXY` và `HTTPS_PROXY` được đặt thành URL của proxy.
- `NODE_USE_ENV_PROXY=1`, để `fetch` có sẵn của Node dùng các biến đó. Node.js thêm biến này trong 24.0.0 và 22.21.0, và đánh dấu nó là đang được phát triển tích cực ([tài liệu Node.js](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS` trỏ tới chứng chỉ CA của proxy, để máy chủ tin tưởng các chứng chỉ mà mockttp tạo ra cho các host HTTPS.

Proxy thuộc về một worker Playwright, nên bài viết khởi động một máy chủ ứng dụng cho mỗi worker từ một worker fixture, mỗi máy chủ trên một cổng trống. Cách này tránh `webServer` của Playwright, thứ khởi động một tiến trình duy nhất cho cả lần chạy trước khi có bất kỳ worker nào. Trong thiết lập của bài viết, các request không khớp quy tắc nào sẽ đi thẳng tới API thật. Bài viết gợi ý thay vào đó hãy trả lời chúng bằng một lỗi, để một mock bị bỏ quên sẽ lộ ra.

Đội ngũ Playwright mô tả cách tiếp cận này là "không phụ thuộc vào ngôn ngữ và framework của máy chủ". Bản thân bài viết dùng một máy chủ Node thuần, không phải Next.js hay TanStack Start.

## Ghi lại response thật bằng test-proxy-recorder {#test-proxy-recorder}

Với ba lựa chọn ở trên, bạn tự viết mọi response. test-proxy-recorder ghi lại những gì API thật của bạn trả về trong một lần chạy cục bộ, rồi phát lại trên CI.

- **Proxy.** Khởi động `test-proxy-recorder <target-url>` cạnh ứng dụng của bạn cho lần chạy test. Trỏ base URL API của ứng dụng về nó khi `TEST_PROXY_RECORDER_ENABLED` được đặt. Mỗi proxy chuyển tiếp tới một backend, chính là `<target-url>` được truyền khi khởi động nó.
- **`registerProxyFetch()`.** Một lời gọi trên máy chủ sẽ patch `fetch` toàn cục. Nó sao chép header `x-test-rcrd-id` của request hiện tại sang mọi request đi ra. Proxy đọc header đó để xếp mỗi lời gọi phía máy chủ vào đúng test của nó. Lời gọi này là no-op trong production trừ khi `TEST_PROXY_RECORDER_ENABLED` được đặt.
- **Id theo từng test.** `playwrightProxy.before(page, testInfo, mode)` tạo một session id từ file spec và tiêu đề của test. Nó gửi id đó dưới dạng `x-test-rcrd-id` trên các request của trang và chuyển session đó sang `record` hoặc `replay`. Các worker song song dùng chung một máy chủ ứng dụng và một proxy, và mỗi test vẫn có bản ghi riêng.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Ghi lại một lần dựa trên API thật rồi commit các file `.mock.json` (máy chủ) và `.har` (trình duyệt). Sau đó CI phát lại chúng với backend đã tắt. Khi phát lại, một request không có bản ghi sẽ nhận một 404 nêu tên request đó. Nó không bao giờ tới được API.

Response đã ghi chỉ bao phủ những gì API đã làm trong lúc bạn ghi lại. Để ép một lỗi hoặc một trường hợp biên mà API không tạo ra theo yêu cầu, một handler viết tay từ một trong các lựa chọn ở trên sẽ đơn giản hơn.

Chi tiết thiết lập nằm trong các hướng dẫn [Next.js](/vi/docs/integrations/nextjs/) và [TanStack Start](/vi/docs/integrations/tanstack-start/).

## So sánh các lựa chọn {#comparison}

| Lựa chọn | Thiết lập trong ứng dụng | Test song song | Handler hay response đã ghi | Next.js và TanStack Start |
| --- | --- | --- | --- | --- |
| [Chế độ test của Next.js](#nextjs-test-mode) | `experimental.testProxy` trong `next.config.js` | Có, handler được giữ theo từng test | Handler (`next.onFetch()`, hoặc handler MSW 2) | Chỉ Next.js |
| [MSW trong máy chủ](#msw) | `setupServer` được khởi động trong mã máy chủ (root layout trong ví dụ của MSW) | Một bộ handler cho mọi test trên máy chủ đó | Handler | Next.js: một ví dụ trong một pull request đang mở. TanStack Start: không có trong tài liệu |
| [mockttp](#mockttp) | Không đổi mã. Các biến proxy và một chứng chỉ CA trên tiến trình máy chủ | Có, với một máy chủ ứng dụng cho mỗi worker | Handler. Request không khớp quy tắc nào được cho đi qua | Không có trong tài liệu. Đội ngũ Playwright gọi nó là không phụ thuộc framework |
| [test-proxy-recorder](#test-proxy-recorder) | Base URL API trỏ về proxy trong lúc test, cộng thêm `registerProxyFetch()` | Có, với một máy chủ ứng dụng dùng chung | Ghi lại từ API thật | Có tài liệu cho cả hai |

[Bản so sánh](/vi/docs/reference/comparison/) bao quát thêm nhiều công cụ, gồm Mocky Balboa, scenarist, Polly.js, talkback và proxay, cùng các lựa chọn phía trình duyệt.
