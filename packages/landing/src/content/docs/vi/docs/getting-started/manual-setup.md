---
title: Thiết lập thủ công
description: Kết nối test-proxy-recorder vào một ứng dụng full-stack (SSR + browser) hoặc một SPA/extension chỉ chạy trên trình duyệt bằng tay, rồi ghi lại một lần và phát lại trên CI.
i18nSource: docs/getting-started/manual-setup.md
i18nSourceBlob: e501bd33c560757d3deacdb3ff90681668099473
---

Hầu hết mọi người nên chạy [`init`](/vi/docs/getting-started/quick-start/) — nó viết mọi file bên dưới cho bạn. Trang này là tài liệu tham chiếu về những gì `init` tạo ra, để bạn có thể tự kết nối bằng tay, bỏ qua phần tạo mã, hoặc hiểu từng thành phần.

## Full-stack (SSR + browser)

Dành cho Next.js và các framework tương tự, nơi cả máy chủ lẫn trình duyệt đều gọi API. Dùng cả hai cơ chế ghi lại cùng nhau — xem [cách thức hoạt động](/vi/docs/getting-started/how-it-works/).

Proxy là một tiến trình nhẹ mà bạn khởi động **song song với ứng dụng trong lúc chạy test** (qua một script như bên dưới, hoặc `webServer` của Playwright) — nó không phải hạ tầng bạn phải deploy hay vận hành. Toàn bộ thiết lập là: khởi động nó cạnh ứng dụng, trỏ base URL API của ứng dụng về nó, truyền tiếp session header từ SSR, và viết một fixture.

### 1. Thêm script vào `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

Trong mã ứng dụng, trỏ base URL API về proxy khi recorder được bật, về backend thật trong trường hợp còn lại — proxy không bao giờ chạy trong production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // địa chỉ proxy
```

`TEST_PROXY_RECORDER_ENABLED` được đặt bởi các script `dev:proxy` / `serve:proxy` ở trên, và bởi các script do `init` tạo. Dùng bất kỳ biến env nào ứng dụng của bạn vốn dùng cho base URL API (ví dụ `API_URL`, `NEXT_PUBLIC_API_URL`) — điều kiện tương tự vẫn áp dụng.

:::note[Next.js]
Ưu tiên `build` + `serve` thay vì `dev` khi ghi lại và phát lại test. Máy chủ dev của Next.js chậm và có thể gây timeout hoặc các bản ghi không ổn định.
:::

### 2. Gắn thẻ cho các fetch phía máy chủ (Next.js)

Các lời gọi `fetch` phía máy chủ cần session header của bản ghi để proxy biết chúng thuộc test nào. Playwright đã đặt nó lên navigation của trình duyệt, nên id nằm trong `next/headers` — bạn chỉ cần gắn nó vào các request SSR đi ra ngoài. Thêm một dòng vào root layout của bạn (`init` làm việc này giúp bạn):

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op trong production trừ khi TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Cách này hoạt động trên cả runtime Node **và** Edge. Với ứng dụng dùng axios, thay vào đó hãy gọi `registerProxyAxios(instance)` trên từng instance phía máy chủ; với một fetch đơn lẻ, `createHeadersWithRecordingId(await headers())` là giải pháp thay thế không cần patch. Một `proxy.ts`/`middleware.ts` với `setNextProxyHeaders` là **tùy chọn** — nó chỉ làm lộ id, chứ không gắn thẻ cho các fetch. **Ghi lại dựa trên bản production build** (`next build && next start`), không phải `next dev`. Xem [tích hợp Next.js](/vi/docs/integrations/nextjs/) để biết chi tiết. Các ứng dụng chỉ chạy trên trình duyệt có thể bỏ qua bước này.

### 3. Viết một test

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Các request SSR (server → proxy) được ghi vào .mock.json.
// Các request trình duyệt tới URL của proxy cũng được xử lý.
const CLIENT_SIDE_URL = /localhost:8100/;

// Đổi thành 'record' để cập nhật các bản ghi.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Ghi lại

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — các file .mock.json và .har được ghi tự động
npx playwright test
```

### 5. Chuyển sang phát lại và commit

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Chỉ chạy trên trình duyệt / SPA / extension

Khi mọi lời gọi API đều đến từ trình duyệt (không có SSR), bạn chỉ cần cơ chế HAR. Không cần backend proxy cho việc ghi lại thực tế — tiến trình proxy chỉ cung cấp việc quản lý session.

### 1. Cài đặt

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Thêm proxy vào `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

Target của proxy (`https://api.example.com`) không quan trọng với việc ghi lại chỉ trên trình duyệt — nó chỉ được dùng nếu các request phía máy chủ (SSR) cũng cần được proxy. Tiến trình proxy phải chạy để endpoint `/__control` của nó sẵn sàng cho việc quản lý session.

### 3. Viết một fixture

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Khớp với domain API bên ngoài mà trình duyệt gửi request tới.
// Ở chế độ ghi lại, các request này đi tới API thật và được lưu lại.
// Ở chế độ phát lại, chúng được trả về từ đĩa — không cần mạng.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Đổi thành 'record' để gọi API thật và cập nhật các bản ghi.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. Viết một test

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Ghi lại — chạy một lần dựa trên API thật

```bash
# Trong fixtures.ts: const MODE = 'record' as const;
npx playwright test
# Các file .har được ghi vào e2e/recordings/ một cách tự động
```

### 6. Chuyển sang phát lại và commit

```bash
# Trong fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

CI giờ chạy mà không cần bất kỳ quyền truy cập mạng nào.

:::caution
Đừng **thêm** `e2e/recordings` vào `.gitignore`. Các bản ghi phải nằm trong git để CI có thể phát lại.
:::

Thêm dòng này vào `.gitattributes` để thu gọn các file bản ghi lớn trong diff của PR:

```text
/e2e/recordings/** binary
```
