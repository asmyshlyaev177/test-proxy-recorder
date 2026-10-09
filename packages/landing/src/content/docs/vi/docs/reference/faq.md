---
title: FAQ
description: Các câu hỏi thường gặp về test-proxy-recorder — phát lại song song, commit các bản ghi vào git, target của proxy cho việc ghi HAR, máy chủ dev của Next.js, và cập nhật các bản ghi.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
---

## Các test phát lại song song của tôi đôi khi gọi backend thật — tại sao? {#parallel-replay}

Nhiều khả năng bạn đang gọi `playwrightProxy.teardown()` trong một hook theo từng test. Nó đặt chế độ proxy **toàn cục** về `transparent`, và với `fullyParallel: true` mỗi worker Playwright chạy `test.afterAll` riêng. Nếu một test nhanh hoàn thành và gọi `teardown()` trong khi một test chậm hơn vẫn đang chạy, proxy lật sang transparent giữa chừng test và các request còn lại bị chuyển tiếp tới backend thật thay vì được phát lại.

```typescript
// ❌ làm hỏng phát lại song song — teardown() ảnh hưởng mọi session toàn cục
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Cách khắc phục:** bỏ `test.afterAll`. Việc dọn session diễn ra tự động qua `context.on('close')` → `cleanupSession()`. Chỉ dùng [global teardown](https://playwright.dev/docs/test-global-setup-teardown) nếu bạn cần reset proxy sau toàn bộ lần chạy.

Timeout của session là cách còn lại khiến một lần chạy phát lại gọi tới backend thật. Mỗi lời gọi `playwrightProxy.before()` khởi động lại nó, còn các request đi qua proxy thì không. Nếu nó hết hạn (mặc định 120000 ms) trước lời gọi `before()` tiếp theo, proxy chuyển sang `transparent`. Khi đó một test vẫn đang chạy sẽ gửi các request còn lại của nó tới backend thật. Nếu một test có thể chạy lâu như vậy, hãy tăng timeout bằng `--timeout` trên [CLI](/vi/docs/guides/cli/) hoặc `timeout` trong [cấu hình](/vi/docs/guides/config/).

## Tôi có thể ghi lại với nhiều worker song song không? {#parallel-recording}

Không. Proxy chỉ giữ một session ghi tại một thời điểm. Khi test thứ hai bắt đầu ghi lại, proxy lưu file của test thứ nhất và chuyển sang test thứ hai. Khi đó các request còn lại của test thứ nhất đi qua proxy sẽ rơi vào `.mock.json` của test thứ hai. Hãy ghi lại với một worker, như script `test:e2e:record` mà `init` thêm vào đã làm sẵn:

```bash
npx playwright test --workers 1
```

Phát lại thì có thể chạy với nhiều worker song song. Mỗi test phát lại session riêng của nó, và header `x-test-rcrd-id` giúp phân biệt chúng: `playwrightProxy.before()` đặt header này lên các request của trang, và `registerProxyFetch()` sao chép nó sang các request phía máy chủ. Các [ứng dụng ví dụ](/vi/docs/reference/examples/) ghi lại với `--workers 1` cũng vì lý do này.

## Tôi có nên commit các bản ghi vào git không?

Có. Các bản ghi phải nằm trong git để CI có thể phát lại chúng không cần mạng — đừng **thêm** `e2e/recordings` vào `.gitignore`. Để các file bản ghi lớn không làm rối việc review PR, hãy đánh dấu chúng là file sinh tự động (generated) trong `.gitattributes`: GitHub mặc định thu gọn diff của chúng nhưng vẫn hiển thị chỉ với một cú nhấp, nên một trường bị API đổi tên vẫn hiện ra khi review. Đánh dấu chúng là `binary` sẽ che hoàn toàn thay đổi đó.

```text
/e2e/recordings/** linguist-generated=true
```

## `<target-url>` của proxy có quan trọng cho việc ghi chỉ trên trình duyệt (HAR) không?

Không. Với việc ghi chỉ trên trình duyệt, target không liên quan — tiến trình proxy chỉ cần chạy để endpoint `/__control` của nó sẵn sàng cho việc quản lý session. Target chỉ quan trọng khi các request phía máy chủ (SSR) cũng được định tuyến qua proxy.

## Điều gì xảy ra với các request trình duyệt nằm ngoài pattern `url`? {#outside-url}

Playwright không chặn chúng, nên chúng đi ra mạng thật ở cả chế độ ghi lại lẫn phát lại. Không có gì được lưu cho chúng. Request tới proxy (`localhost:8100`) là ngoại lệ. `playwrightProxy.before()` luôn chuyển tiếp các request đó tới proxy, nơi tự ghi lại và phát lại chúng.

Để một test không đi ra mạng, hãy mở rộng `url` để HAR bao phủ domain đó, hoặc chặn hẳn domain đó bằng `page.route()` và `route.abort()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // HAR cũng ghi lại và phát lại cả CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Các lời gọi analytics thất bại thay vì đi ra mạng.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

[Cách phát lại khớp request](/vi/docs/getting-started/how-it-works/#replay-matching) có đầy đủ chi tiết.

## Tôi có thể ghi lại dựa trên máy chủ dev của Next.js không?

Ưu tiên `next build` + `next start` thay vì `next dev` khi ghi lại và phát lại. Máy chủ dev chậm và có thể gây timeout hoặc các bản ghi không ổn định.

## Làm thế nào để cập nhật một bản ghi?

Chạy lại ở chế độ ghi lại (`RECORD_MODE=1`, tức script `test:e2e:record`) dựa trên API thật, rồi commit các file đã cập nhật trong `e2e/recordings/`.

## Tôi có thể ép một lỗi, một danh sách rỗng hoặc một response chậm trong test phát lại không? {#override-responses}

Có, với các request trình duyệt. Playwright chạy các route handler [theo thứ tự ngược với thứ tự đăng ký](https://playwright.dev/docs/api/class-route#route-fallback), nên một `page.route()` được thêm sau `playwrightProxy.before()` sẽ thấy mỗi request trước tiên. Nó có thể tự trả lời request, hoặc gọi `route.fallback()` để chuyển request tiếp cho các bản ghi.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Được thêm sau before(), nên Playwright chạy handler này trước.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // mọi request khác được phát lại như đã ghi
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

Với một danh sách rỗng, thay vào đó hãy fulfill bằng `json: []`. Với một response chậm, hãy chờ trước khi gọi `route.fallback()`, chẳng hạn bằng `await new Promise((resolve) => setTimeout(resolve, 3000))`. Khi đó response đã ghi sẽ đến muộn ba giây.

Các request phía máy chủ không bao giờ đi qua trình duyệt, nên `page.route()` không thể thay đổi chúng. Với các request đó, hãy sửa bản ghi trong `.mock.json` bằng tay, hoặc ghi lại dựa trên một API đang ở đúng trạng thái bạn cần. Trong file, `response` của mỗi bản ghi chứa `statusCode`, `headers` và `body`. Nếu bạn thay đổi độ dài của body, hãy xóa luôn header `content-length`.

## Tôi có thể dùng nó khi bộ test kiểm thử một môi trường đã deploy không? {#deployed-environment}

Có, với các request trình duyệt. Playwright chặn chúng ngay trong trình duyệt, nên HAR ghi lại và phát lại chúng mà không cần thay đổi ứng dụng đã deploy. Hãy trỏ `url` tới domain API mà trình duyệt gọi. Proxy vẫn phải chạy cạnh các test, vì `playwrightProxy.before()` đặt chế độ của mỗi test qua endpoint `/__control` của proxy.

Các request phía máy chủ do máy chủ của ứng dụng thực hiện, nên một proxy trên CI không bao giờ thấy các request mà một máy chủ đã deploy gửi đi. Để ghi lại hoặc phát lại chúng, hãy chạy máy chủ của ứng dụng trên CI cạnh proxy. Build và khởi động nó cho lần chạy test với base URL API trỏ về proxy và `TEST_PROXY_RECORDER_ENABLED=true` được đặt. Các trang [Next.js](/vi/docs/integrations/nextjs/) và [TanStack Start](/vi/docs/integrations/tanstack-start/) trình bày thiết lập này.
