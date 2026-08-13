---
title: Ứng dụng ví dụ
description: Các ví dụ hoàn chỉnh và chạy được của test-proxy-recorder — SSR của Next.js và TanStack Start, một extension Chrome, một ticker WebSocket bên thứ ba, và một ứng dụng xác thực được phát lại không cần backend.
i18nSource: docs/reference/examples.md
i18nSourceBlob: d58a37f3eb41cbc0c0319b630b35da2930081ea1
---

Các ví dụ hoàn chỉnh và chạy được nằm trong [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — một ví dụ cho mỗi cơ chế ghi lại. Mỗi ví dụ có README riêng với thiết lập đầy đủ và quy trình ghi lại/phát lại.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — một ứng dụng todo Next.js 16 với một mock backend, proxy, và test e2e Playwright. Ghi lại cả fetch SSR (`.mock.json`) lẫn fetch trình duyệt (`.har`), và bao gồm một chat WebSocket dựa trên backend cục bộ. Xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md) của nó.

## Next.js Edge runtime {#nextjs-edge}

[`apps/example-nextjs-edge`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — một ứng dụng Next.js 16 có trang render trên **Edge runtime** (`export const runtime = 'edge'`). `fetch` SSR của nó được gắn thẻ bằng id của phiên ghi qua `registerProxyFetch()` (gọi từ root layout), nên các phiên phát lại đồng thời vẫn phân biệt được ở nơi `instrumentation.ts` không thể chạm tới. Xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs-edge/README.md) của nó.

## TanStack Start {#tanstack-start}

[`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — một ứng dụng TanStack Start (Vite + Nitro) xây bằng **TanStack Query**. Ghi lại cả fetch SSR (`.mock.json`, gắn thẻ qua `registerProxyFetch()` trong `src/router.tsx`) lẫn fetch trình duyệt (`.har`), bao phủ một danh sách todo trực tiếp, một route ISR bằng cache-header, chat WebSocket, và một đăng nhập **AWS Cognito** thật (auth ở chế độ transparent + một API được bảo vệ với token bị loại bỏ). Xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-tanstack-start/README.md) của nó.

## Extension Chrome {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — một extension Chrome thật gọi API của X/Twitter từ một content script; các request trình duyệt được ghi vào `.har` và phát lại offline, không cần API trực tiếp hay tài khoản trên CI. Xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md) của nó.

## Crypto ticker — WebSocket bên thứ ba {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — một ticker giá BTC-USD trực tiếp dựa trên feed WebSocket công khai của Binance. Ghi lại feed thật một lần qua proxy, rồi phát lại các mức giá tất định trên CI không cần mạng hay tài khoản sàn giao dịch. Xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md) của nó.

## Ứng dụng xác thực {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — một ứng dụng Next.js đăng nhập vào một user pool **AWS Cognito thật**, rồi ghi lại/phát lại API được bảo vệ của nó. Việc đăng nhập luôn trực tiếp trong mỗi lần chạy (không bao giờ được ghi lại); dữ liệu được bảo vệ phát lại với backend đã tắt, và auth token bị loại bỏ khỏi các bản ghi. Việc tích hợp chỉ là một vài file — xem [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md) của nó. Với cùng pattern **không cần tài khoản cloud**, xem [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
