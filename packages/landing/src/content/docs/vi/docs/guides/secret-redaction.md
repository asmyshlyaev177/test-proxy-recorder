---
title: Loại bỏ bí mật
description: Việc loại bỏ bí mật bật theo mặc định — Authorization, Cookie, và Set-Cookie bị loại bỏ khỏi các bản ghi trước khi được ghi ra đĩa. Thêm các pattern cho header và body, allow-list cookie, hoặc loại bỏ theo lập trình.
i18nSource: docs/guides/secret-redaction.md
i18nSourceBlob: ae994d1669a0b96d18dde3e6e4885e4c1404c2a3
---

Các bản ghi được commit vào git, nên bí mật bị loại bỏ trước khi bất cứ thứ gì được ghi ra đĩa. Việc loại bỏ bí mật **bật theo mặc định** mỗi khi proxy chạy từ CLI hoặc từ file cấu hình, và đó là cách `init` thiết lập nó; proxy thay giá trị của các header request/response sau bằng `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

Điều này an toàn: việc khớp khi phát lại bỏ qua các header này, nên việc loại bỏ không bao giờ làm hỏng việc phát. Nó áp dụng cho các bản ghi `.mock.json`, các bản ghi WebSocket, và các file `.har`. Khác với các bản ghi của proxy, các file `.har` nằm trên đĩa mà chưa được loại bỏ bí mật cho tới khi lần chạy kết thúc, lúc `playwrightProxy.teardown()` loại bỏ bí mật khỏi chúng từ global teardown của bạn. Để tắt việc loại bỏ, truyền `--no-redact` trên CLI hoặc đặt `redaction: false` trong [cấu hình](/vi/docs/guides/config/).

Khi chỉ *một số* cookie nhạy cảm, hãy allow-list những cookie vô hại theo tên (ví dụ cookie `theme` hoặc A/B-test). Các cookie được allow-list giữ nguyên giá trị bên trong `Cookie`/`Set-Cookie`; mọi cookie khác vẫn bị loại bỏ.

:::note[Cách các file `.har` được loại bỏ]
Các file `.har` được viết bởi `routeFromHAR` của Playwright, không phải proxy, nên chúng được loại bỏ trong một lượt riêng. `playwrightProxy.teardown()` viết lại mọi file `.har` trong thư mục bản ghi dùng **cùng cấu hình loại bỏ** như proxy (headers, `allowCookies`, và `bodyPatterns` đều áp dụng, cho cả các header lẫn các mảng `cookies` đã parse). Việc này chạy từ **`globalTeardown`** của Playwright — nên loại bỏ HAR đòi hỏi một `globalTeardown` gọi `playwrightProxy.teardown()` ([thiết lập được khuyến nghị](/vi/docs/integrations/playwright/#global-teardown-recommended), do `init` dựng sẵn).

Nó không thể chạy theo từng test: Playwright ghi HAR khi context của nó đóng nhưng không chờ các close handler, nên việc loại bỏ ở đó chạy đua với lúc tiến trình thoát và có thể cắt cụt file. Teardown lấy cấu hình từ `/__control` (proxy phải đang chạy; nếu không truy cập được, các mặc định header có sẵn vẫn áp dụng), chỉ viết lại các file nó thực sự thay đổi, và để nguyên các response body base64. Để phòng thủ theo chiều sâu, vẫn nên ghi lại bằng các credential test ngắn hạn và xem lại HAR trước khi commit — xem pattern auth được khuyến nghị bên dưới.
:::

## Pattern auth được khuyến nghị

Để giữ luồng đăng nhập và credential nằm hoàn toàn ngoài các bản ghi, hãy chạy xác thực trong một **setup project** của Playwright với proxy ở chế độ `transparent`, lưu `storageState` vào một `auth-state.json` được **gitignore**, và tái sử dụng nó trong các test của bạn. Các request đã ghi khi đó chỉ mang theo các session header (đã được loại bỏ), không bao giờ chứa phần đăng nhập.

Xem [ví dụ ứng dụng xác thực](/vi/docs/reference/examples/#authenticated-app) để biết một thiết lập hoạt động dựa trên một auth provider thật.

## Tinh chỉnh những gì bị loại bỏ

Các header mặc định luôn áp dụng (khi việc loại bỏ đang bật); bạn có thể thêm vào chúng.

### Cờ CLI

- `--no-redact` — tắt việc loại bỏ bí mật (bật theo mặc định).
- `--redact` — bật việc loại bỏ bí mật; chỉ cần khi bật lại vì cấu hình đặt `redaction: false`.
- `--redact-headers <names>` — các tên header bổ sung để loại bỏ, phân tách bằng dấu phẩy (gộp với các mặc định).
- `--redact-body <patterns>` — các pattern regex để loại bỏ khỏi body request/response, phân tách bằng dấu phẩy.
- `--allow-headers <names>` — các tên header được miễn loại bỏ, phân tách bằng dấu phẩy (ví dụ `set-cookie`).
- `--allow-cookies <names>` — các tên cookie được giữ nguyên không bị loại bỏ bên trong `Cookie`/`Set-Cookie`, phân tách bằng dấu phẩy.

```bash
# Việc loại bỏ đã bật; đồng thời loại bỏ header API-key và các token "sk_live_...", giữ cookie theme
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Theo lập trình

Khi bạn tự khởi tạo `ProxyServer`, mặc định của CLI không áp dụng: việc loại bỏ bí mật bị tắt trừ khi bạn truyền một cấu hình.

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Truyền đối tượng này để bật việc loại bỏ; truyền `false` (hoặc không truyền gì) để giữ nó tắt.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // các header bổ sung, gộp với các mặc định
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // các regex được thay trong body request/response
  allowHeaders: ['set-cookie'],        // không bao giờ loại bỏ các header này
  allowCookies: ['theme', 'locale'],   // giữ các cookie này bên trong Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // mặc định
});
```

`redactSession(session, config)` cũng được export nếu bạn muốn tự loại bỏ các bản ghi hiện có.
