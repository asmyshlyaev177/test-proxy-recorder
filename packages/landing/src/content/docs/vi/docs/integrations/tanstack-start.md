---
title: TanStack Start
description: Gắn thẻ cho các fetch phía máy chủ của TanStack Start bằng session header của bản ghi để SSR được ghi lại và phát lại — qua registerProxyFetch (khuyến nghị) hoặc createHeadersWithRecordingId cho từng lời gọi.
i18nSource: docs/integrations/tanstack-start.md
i18nSourceBlob: 6367cedc46bf4ac859e573ca269e63e8d98be33a
---

TanStack Start chạy loaders và server functions trên máy chủ, nên các lời gọi `fetch` của chúng đi qua proxy mà không có browser context — tình huống tương tự [SSR của Next.js](/vi/docs/integrations/nextjs/). Proxy xác định các request đó thuộc session nào qua header `x-test-rcrd-id`. `playwrightProxy.before()` của Playwright đã đặt nó lên navigation của trình duyệt kích hoạt SSR, nên id đến trên request máy chủ vào — việc cần làm là **gắn nó vào các request phía máy chủ đi ra ngoài**. (Các test chỉ chạy trên trình duyệt không cần gì trong số này; proxy rơi về session được đặt toàn cục.)

:::caution[Ghi lại dựa trên bản production build]
Ghi lại bằng `vite build` + `node .output/server/index.mjs` (tức là `pnpm start`), không phải `vite dev`. Context theo từng request của máy chủ dev khác với runtime production mà `registerProxyFetch()` patch. Vì máy chủ production chạy ở chế độ production, hãy đặt `TEST_PROXY_RECORDER_ENABLED=true` trên tiến trình ứng dụng cho lần chạy e2e của bạn.
:::

## registerProxyFetch (khuyến nghị)

Một dòng trong **router setup** gắn thẻ cho mọi `fetch` phía máy chủ — route loaders, server functions, và server routes:

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // no-op trên client / trong production trừ khi TEST_PROXY_RECORDER_ENABLED=true
```

Nó patch `fetch` toàn cục để sao chép `x-test-rcrd-id` của request hiện tại lên các request đi ra, đọc nó từ server request context của TanStack Start (`getRequestHeader`). Đặt nó ở đầu `src/router.tsx` — module đó chạy trên máy chủ cho mỗi request SSR, và lời gọi là idempotent, no-op trên client, và no-op trong production trừ khi recorder được bật tường minh.

## Theo từng lời gọi — createHeadersWithRecordingId

Không cần patch. Dùng nó cho một fetch đơn lẻ bên trong một loader hoặc server function, hoặc khi bạn không muốn patch `fetch` toàn cục:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

`getRecordingId()` cũng được export nếu bạn muốn lấy id thô (hoặc `null`) để tự chuyển tiếp. Cả hai đều đọc id của request hiện tại từ server context, và đều no-op trong production trừ khi `TEST_PROXY_RECORDER_ENABLED=true`.

## Trỏ ứng dụng về proxy

Trong dev/test, hãy trỏ các base URL backend của bạn về proxy để **cả hai** origin đều được ghi lại — base phía máy chủ (được đọc bởi loaders/server functions, ví dụ `BACKEND_URL`) và base phía trình duyệt được nướng vào lúc build (`VITE_API_URL`). Trong production, trỏ chúng về backend thật. Các request phía trình duyệt được xử lý bởi cơ chế HAR của `playwrightProxy.before()`, đúng như trong [thiết lập thủ công](/vi/docs/getting-started/manual-setup/).

## Ứng dụng xác thực

Recorder [hoạt động với auth provider thật của bạn](/vi/docs/getting-started/how-it-works/) (AWS Cognito, Auth0, Clerk, …), và nó kết hợp với việc gắn thẻ SSR ở trên. Pattern là:

- **Đăng nhập thật, ở chế độ `transparent`.** Một `setup` project của Playwright đăng nhập một lần với proxy pass-through, để phần đăng nhập **không bao giờ được ghi lại**, và lưu session (`storageState`) mà các spec xác thực tái sử dụng.
- **Các request được bảo vệ mang token và được ghi lại.** Mỗi request xác thực gửi header `Authorization: Bearer …`; recorder [loại bỏ](/vi/docs/guides/secret-redaction/) nó, nên không token nào lọt vào các bản ghi đã commit.
- **Nơi token lưu trữ quyết định cơ chế.** Một token trong `localStorage` không thể đọc trên máy chủ, nên fetch được bảo vệ chạy trong trình duyệt và được ghi lại qua HAR — không có SSR prefetch. Ngược lại, một session dựa trên cookie có thể được chuyển tiếp vào một loader bằng `createHeadersWithRecordingId()` và được ghi phía máy chủ.

Ứng dụng [`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) bao gồm một luồng `/login` → `/dashboard` AWS Cognito chạy được (`e2e/setup-auth.ts` + `e2e/auth.spec.ts`) minh họa đúng điều này.

## Ví dụ đầy đủ

Một ứng dụng hoàn chỉnh và chạy được — xây bằng **TanStack Query** (SSR prefetch + `useMutation`), bao phủ todos (trình duyệt + SSR), một route ISR bằng cache-header, một ca loại bỏ bí mật, chat WebSocket, và một đăng nhập AWS Cognito thật (auth ở chế độ transparent + một API được bảo vệ đã ghi với token bị loại bỏ), tất cả được ghi lại và phát lại — nằm trong [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Nó cho thấy recorder trong suốt với tầng dữ liệu của bạn: `registerProxyFetch()` gắn thẻ các fetch `queryFn` của Query trong lúc SSR mà không cần bất kỳ mã Query riêng nào.
