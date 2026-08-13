---
title: Next.js
description: Gắn thẻ cho các fetch phía máy chủ của Next.js bằng session header của bản ghi để SSR được ghi lại và phát lại — qua registerProxyFetch (khuyến nghị, mọi runtime), registerProxyAxios cho axios, hoặc createHeadersWithRecordingId cho từng lời gọi. Middleware là tùy chọn.
i18nSource: docs/integrations/nextjs.md
i18nSourceBlob: 5cf29035e538718ddd86bfc78d782a0468c8c3f7
---

Các framework SSR như Next.js thực hiện các lời gọi `fetch` phía máy chủ đi qua proxy mà không có browser context. Proxy xác định các request đó thuộc session nào qua header `x-test-rcrd-id`. `playwrightProxy.before()` của Playwright đã đặt nó lên navigation của trình duyệt kích hoạt SSR, nên id có sẵn trong `next/headers` — việc cần làm là **gắn nó vào các request phía máy chủ đi ra ngoài**. (Các test chỉ chạy trên trình duyệt không cần gì trong số này; proxy rơi về session được đặt toàn cục.)

:::tip
[`test-proxy-recorder init`](/vi/docs/getting-started/quick-start/) phát hiện Next.js và tự động kết nối cách tiếp cận được khuyến nghị bên dưới vào root layout của bạn.
:::

:::caution[Ghi lại dựa trên bản production build]
Ghi lại bằng `next build && next start`, không phải `next dev`. Máy chủ dev có thể reset patch `fetch` toàn cục giữa các request ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), và chậm hơn/không ổn định hơn. Vì `next start` chạy ở chế độ production, hãy đặt `TEST_PROXY_RECORDER_ENABLED=true` trên tiến trình ứng dụng cho lần chạy e2e của bạn.
:::

## registerProxyFetch (khuyến nghị)

Một dòng trong **root layout** gắn thẻ cho mọi `fetch` phía máy chủ — Server Components, Route Handlers, trên cả runtime Node **và** Edge:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op trong production trừ khi TEST_PROXY_RECORDER_ENABLED=true
```

Nó patch `fetch` toàn cục để sao chép `x-test-rcrd-id` của request hiện tại lên các request đi ra, giúp proxy phân biệt các phiên phát lại đồng thời. Gọi nó từ root layout — **không phải** `instrumentation.ts`, vì context của nó khác với context render các route của bạn trên runtime Edge, nên một patch ở đó âm thầm không bao giờ chạy.

## axios — registerProxyAxios

Nếu các request phía máy chủ của bạn đi qua axios, đăng ký từng instance phía máy chủ một lần:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

Nó thêm một request interceptor đóng dấu id (không bao giờ đụng tới `fetch` toàn cục), nên miễn nhiễm với hạn chế của máy chủ dev ở trên. No-op trong production / trên trình duyệt; idempotent theo từng instance; không bao giờ ghi đè id do người gọi đặt.

## Theo từng lời gọi — createHeadersWithRecordingId

Không cần patch, và cũng hoạt động dưới `next dev`. Dùng nó cho một fetch đơn lẻ, hoặc khi bạn không muốn patch `fetch` toàn cục:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (tùy chọn)

Một `proxy.ts` (Next.js 16+, export `proxy`) hoặc `middleware.ts` (15 trở xuống, export `middleware`) gọi `setNextProxyHeaders` giúp id có sẵn qua `next/headers`, nhưng **không gắn thẻ cho các fetch đi ra** — nên nó không bắt buộc khi bạn đã dùng một trong các helper ở trên. Chỉ dùng nó nếu bạn vốn đã có một middleware (auth, v.v.), và vẫn kết hợp với một helper để thực hiện việc gắn thẻ:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // làm lộ id; kết hợp với một helper ở trên
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Xem [tham chiếu API](/vi/docs/reference/api/readme/) để biết chữ ký đầy đủ của các helper `test-proxy-recorder/nextjs`. Một dự án Edge hoàn chỉnh và chạy được nằm trong [ví dụ Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

## Caching & ISR

Đừng tắt caching cho test — recorder hoạt động tốt với một route được cache/ISR. Nhưng có một quy tắc quyết định toàn bộ thiết kế: **để phát lại một fetch SSR, trang phải thực hiện fetch đó ở thời điểm request.** Một route trả về HTML đã prerender hoặc một render cache cũ không bao giờ thực hiện fetch, nên proxy không có gì để trả về và assertion nhìn thấy nội dung cũ.

Cách để giữ tất định là cache fetch SSR bằng `next.revalidate` + `next.tags` ở cấp fetch, rồi làm vô hiệu theo yêu cầu trước assertion:

```tsx
// app/isr/page.tsx — không có `export const dynamic`, không có `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // Next.js 16 đòi hỏi đối số profile thứ 2
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // purge cứng
await page.goto('/isr');                     // một navigation — tất định
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

`revalidateTag` trên một mục cache của **fetch** là một *hard purge*: lần đọc tiếp theo là một cache miss chặn và re-fetch qua proxy. Bạn phải purge trước navigation phát lại vì data cache tồn tại qua các pha record → replay của cùng một tiến trình `next start` — nếu không, phát lại sẽ trả về cache của pha ghi lại và không bao giờ chạm proxy (một lần pass giả).

Trong lúc test, `fetch` đã patch đọc `headers()`, nên trang render động và thực sự chạy fetch. Trong production (recorder bị tắt), không gì đọc `headers()` và trang là ISR tĩnh như bình thường — render động được giới hạn trong test, và là bản chất của việc ghi lại một fetch SSR.

:::caution[Tránh `unstable_cache` cho việc này]
`unstable_cache` là *stale-while-revalidate*: `revalidateTag` đánh dấu mục của nó là cũ, lần đọc tiếp theo trả về giá trị cũ và tái tạo trong **nền**, nên giá trị mới xuất hiện sau assertion của bạn — không ổn định, ngay cả trên trang `force-dynamic` và ngay cả với một request làm nóng. Thay vào đó hãy dùng `next.tags` ở cấp fetch (một hard purge).
:::

Revalidation theo yêu cầu là đặc quyền (nó purge cache và ép tái tạo), nên hãy bảo vệ route sau một secret dùng chung — fail closed nếu không được đặt, so sánh trong thời gian hằng số, và gắn token từ test qua `use.extraHTTPHeaders` của Playwright để spec không bao giờ chạm tới nó.

Xem ví dụ đầy đủ và chạy được (một phần của [ví dụ Next.js 16](/vi/docs/reference/examples/#nextjs-16)):

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — trang được cache (`next.tags` ở cấp fetch)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — cách bảo vệ `revalidateTag`: fail-closed + so sánh secret trong thời gian hằng số
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — làm vô hiệu, rồi một navigation; assertion rằng lời gọi revalidate thành công
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — nạp `.env` và gắn secret qua `extraHTTPHeaders`

## Script package.json

Khởi động các dịch vụ từ script, không phải từ `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

Một dự án hoàn chỉnh và chạy được nằm trong [ví dụ Next.js 16](/vi/docs/reference/examples/#nextjs-16).
