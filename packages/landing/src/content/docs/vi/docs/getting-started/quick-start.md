---
title: Bắt đầu nhanh
description: Thiết lập test-proxy-recorder bằng một lệnh init duy nhất — tốt nhất là để AI agent điều khiển. Trỏ API của bạn về proxy, ghi lại một lần, phát lại trên CI.
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 1f0c3114d600fcebf0696c67788cd60c9b6558db
---

## Thiết lập bằng AI agent (khuyến nghị)

Sao chép đoạn này và dán vào AI coding agent của bạn (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

Agent sẽ thêm các skill, dựng mọi thứ bằng `init` (config, Playwright fixture, teardown, script, và — với Next.js — `registerProxyFetch()` trong root layout của bạn), rồi hoàn tất phần kết nối mà `init` không thể đoán được từ prompt mà `init` in ra. Muốn có một thiết lập hoàn chỉnh để tham khảo? Xem [các ví dụ](/vi/docs/reference/examples/).

## Hoặc tự kết nối bằng tay

`init` viết mọi thứ và không ghi đè bất cứ thứ gì:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # chỉ Next.js — thêm registerProxyFetch() để gắn thẻ cho các fetch SSR
e2e/fixtures.ts          # ghi lại so với phát lại
e2e/global-teardown.ts
package.json             # + script proxy / test:e2e
```

### 1. Trỏ API của ứng dụng về proxy

Điều duy nhất `init` không đoán được: biến env nào chứa base URL API của bạn. Trỏ nó về proxy khi recorder được bật, về backend thật trong trường hợp còn lại — proxy không bao giờ chạy trong production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // địa chỉ proxy từ `init`
```

### 2. Gắn thẻ cho các fetch phía máy chủ (chỉ Next.js)

Các request trình duyệt đã mang theo id của phiên ghi (Playwright đặt nó). Với các fetch phía máy chủ (SSR, Server Components), hãy thêm một dòng vào root layout để chúng cũng được gắn thẻ — `init` làm việc này giúp bạn:

```tsx
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

Dùng axios cho các lời gọi phía máy chủ? Thay vào đó hãy dùng `registerProxyAxios(instance)`. Ghi lại dựa trên bản production build (`next build && next start`), không phải `next dev`. Các ứng dụng chỉ chạy trên trình duyệt (SPA, extension) có thể bỏ qua bước này.

### 3. Ghi lại một lần, phát lại mãi mãi

```bash
# fixtures.ts: MODE = 'record' — ghi lại các response thật
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — sau đó commit các bản ghi
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

CI giờ phát lại với backend đã tắt — cùng các response mỗi lần chạy.

---

Chi tiết hơn: [thiết lập thủ công](/vi/docs/getting-started/manual-setup/) · [cách thức hoạt động](/vi/docs/getting-started/how-it-works/) · [skill cho AI agent](/vi/docs/reference/ai-agent-skills/).
