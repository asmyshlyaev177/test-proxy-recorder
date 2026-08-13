---
title: React Router / Remix
description: Một tích hợp React Router 7 (framework mode) và Remix hạng nhất cho test-proxy-recorder đang nằm trong lộ trình. Cho tới khi nó ra mắt, hãy tự chuyển tiếp session header của bản ghi từ loaders và actions bằng tay.
i18nSource: docs/integrations/react-router.md
i18nSourceBlob: 84a70df0fa049d7fe27235ed2884156c7bb75cfa
---

:::caution[Đang trong lộ trình]
Một adapter hạng nhất cho React Router 7 framework mode (những gì "Remix" thực chất có nghĩa hiện nay) đã được lên kế hoạch nhưng chưa phát hành. Trang này mô tả pattern thủ công hoạt động ngay hôm nay, và sẽ được thay bằng hướng dẫn riêng khi adapter ra mắt. Muốn có nó sớm hơn? [Mở một issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

Loaders và actions của React Router 7 chạy trên máy chủ, nên các lời gọi `fetch` của chúng đi qua proxy mà không có browser context — tình huống tương tự [SSR của Next.js](/vi/docs/integrations/nextjs/). Proxy cần header `x-test-rcrd-id` trên các request phía máy chủ đó để gán chúng vào đúng session ghi lại.

## Pattern thủ công (hoạt động ngay hôm nay)

Mỗi loader/action nhận `request` đến. Đọc header recording-id từ nó và chuyển tiếp nó trên bất kỳ `fetch` phía máy chủ nào:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Chỉ trỏ base API về proxy trong dev/test.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Chỉ trỏ base URL backend của bạn về proxy (`http://localhost:8100`) trong dev/test, đúng như trong [thiết lập thủ công](/vi/docs/getting-started/manual-setup/). Các request phía trình duyệt vẫn được xử lý bởi cơ chế HAR của `playwrightProxy.before()`.

Khi adapter ra mắt, việc này sẽ rút gọn thành một import helper duy nhất — theo dõi tiến độ trên [lộ trình](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
