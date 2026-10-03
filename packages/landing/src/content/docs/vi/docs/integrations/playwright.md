---
title: 'Thiết lập Playwright: ghi lại và phát lại từng test'
description: Ghi lại và phát lại lời gọi API trong test Playwright với test-proxy-recorder, dùng hook session before(), global teardown được khuyến nghị, và file bản ghi riêng cho từng test.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 26b8b462ae4153046421443a751392892c37c34b
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

**Ngoại lệ — các ứng dụng full-stack:** khi trình duyệt cũng gọi `localhost:8100` (vì frontend được cấu hình với URL proxy làm base API), hãy dùng `/localhost:8100/` làm pattern. Khi đó các request trình duyệt này đi thẳng tới proxy, nơi ghi chúng vào `.mock.json` của test và phát lại chúng từ file đó, nên một request bị thiếu sẽ nhận 404 của proxy thay vì bị HAR hủy (xem [cách phát lại khớp request](/vi/docs/getting-started/how-it-works/#replay-matching)).

Tên file bản ghi được sinh từ tên test (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Global teardown (khuyến nghị) {#global-teardown-recommended}

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
