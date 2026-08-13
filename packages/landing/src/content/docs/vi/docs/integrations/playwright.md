---
title: Playwright
description: Dùng test-proxy-recorder từ test Playwright — hook session before(), global teardown được khuyến nghị, và nơi các file bản ghi được lưu.
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 1f1c2b10ddff1657ae98b71b6961c9311f30b52f
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

Gọi hàm này ở đầu mỗi test (hoặc trong một `beforeEach` / page fixture). Nó đặt chế độ proxy cho session và, nếu `url` được cung cấp, thiết lập việc ghi HAR cho các request phía trình duyệt.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern cho các request phía trình duyệt cần ghi lại/phát lại qua HAR.
  //
  // Dùng domain API bên ngoài THỰC TẾ — không phải URL của proxy.
  // Ví dụ:
  //   /api\.example\.com/           — API của riêng bạn
  //   /x\.com/                      — ghi lại mọi traffic trình duyệt x.com (test extension Chrome)
  //   /cognito-.*amazonaws\.com/    — auth bên thứ ba
  url: /api\.example\.com/,
});
```

**Pattern `url`:** khớp với domain bên ngoài thực mà trình duyệt gọi. Ở chế độ ghi lại, các request đi tới API thật và được lưu vào một file `.har`. Ở chế độ phát lại, chúng được trả về từ file đó — không cần mạng. Pattern này **không** trỏ tới proxy (`localhost:8100`).

**Ngoại lệ — các ứng dụng full-stack:** khi trình duyệt cũng gọi `localhost:8100` (vì frontend được cấu hình với URL proxy làm base API), hãy dùng `/localhost:8100/` làm pattern.

Tên file bản ghi được sinh từ tên test (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Global teardown (khuyến nghị)

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` reset proxy về `transparent` và chạy lượt [loại bỏ bí mật](/vi/docs/guides/secret-redaction/) cho HAR. Đừng gọi nó trong hook `afterAll` theo từng test dưới `fullyParallel` — xem [FAQ](/vi/docs/reference/faq/#parallel-replay) để biết tại sao điều đó làm hỏng việc phát lại song song.

## Các file bản ghi

```text
e2e/recordings/
  my-test.mock.json   # phía máy chủ (proxy) — các fetch SSR
  my-test.har         # phía client (HAR)   — các fetch của trình duyệt
```
