---
title: FAQ
description: Các câu hỏi thường gặp về test-proxy-recorder — phát lại song song, commit các bản ghi vào git, target của proxy cho việc ghi HAR, máy chủ dev của Next.js, và cập nhật các bản ghi.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 35d6fcf35338b9b64fd4c7988beea62f0a7219d3
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

## Tôi có nên commit các bản ghi vào git không?

Có. Các bản ghi phải nằm trong git để CI có thể phát lại chúng không cần mạng — đừng **thêm** `e2e/recordings` vào `.gitignore`. Để tránh các file bản ghi lớn làm phình diff của PR, đánh dấu chúng là binary trong `.gitattributes`:

```text
/e2e/recordings/** binary
```

## `<target-url>` của proxy có quan trọng cho việc ghi chỉ trên trình duyệt (HAR) không?

Không. Với việc ghi chỉ trên trình duyệt, target không liên quan — tiến trình proxy chỉ cần chạy để endpoint `/__control` của nó sẵn sàng cho việc quản lý session. Target chỉ quan trọng khi các request phía máy chủ (SSR) cũng được định tuyến qua proxy.

## Tôi có thể ghi lại dựa trên máy chủ dev của Next.js không?

Ưu tiên `next build` + `next start` thay vì `next dev` khi ghi lại và phát lại. Máy chủ dev chậm và có thể gây timeout hoặc các bản ghi không ổn định.

## Làm thế nào để cập nhật một bản ghi?

Chạy lại ở chế độ ghi lại (đặt `MODE = 'record'` trong fixture của bạn, hoặc `RECORD_MODE=1`) dựa trên API thật, rồi chuyển về phát lại và commit các file đã cập nhật trong `e2e/recordings/`.
