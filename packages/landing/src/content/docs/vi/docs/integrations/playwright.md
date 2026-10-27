---
title: 'Thiết lập Playwright: ghi lại và phát lại từng test'
description: Ghi lại và phát lại lời gọi API trong test Playwright với test-proxy-recorder, dùng hook session before(), global teardown được khuyến nghị, và file bản ghi riêng cho từng test.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 41506a06c67c43287c172907f5ef6c6ef07e36e3
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

Tên file bản ghi được lấy từ file test, các tiêu đề `describe` và tiêu đề test (`users.spec.ts` › `create a user` → `users__create-a-user.mock.json` / `.har`). Một tên dài hơn 120 byte sẽ bị cắt ngắn và kết thúc bằng một hash.

## Test không có bản ghi

Ở chế độ phát lại, `before()` ném lỗi khi test không có bản ghi, trước khi nó chuyển chế độ của proxy:

```text
[test-proxy-recorder] This test has no recording: <recordingsDir>/users__create-a-user.mock.json does not exist. Record this test first.
```

Hãy ghi lại test thay vì bỏ qua nó: một test bị bỏ qua được báo cáo là skipped, không phải failed, nên một bản ghi bị thiếu sẽ không ai để ý. `hasRecording(testInfo)` trả lời cùng câu hỏi đó mà không ném lỗi, dùng cùng các tên file như khi phát lại.

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

`teardown()` reset proxy về `transparent` và chạy lượt [loại bỏ bí mật](/vi/docs/guides/secret-redaction/) cho HAR. Việc chuyển sang `transparent` lưu và kết thúc mọi session ghi lại. Đừng gọi nó trong hook `afterAll` theo từng test dưới `fullyParallel` — xem [FAQ](/vi/docs/reference/faq/#parallel-replay) để biết tại sao điều đó làm hỏng việc phát lại và ghi lại song song.

## Các file bản ghi

```text
e2e/recordings/
  my-test.mock.json   # phía máy chủ (proxy) — các fetch SSR
  my-test.har         # phía client (HAR)   — các fetch của trình duyệt
```
