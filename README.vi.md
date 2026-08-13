<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · Tiếng Việt
<!-- i18n:meta locale=vi source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **VCR cho Playwright** — ghi lại các response API thật một lần, phát lại chúng một cách tất định trên CI. Bao phủ SSR của Next.js & TanStack Start, trình duyệt, và traffic WebSocket. Không cần backend, không cần mock viết tay.

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Ghi lại các response API thật, rồi phát lại chúng trên CI với backend đã tắt" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## Tại sao

Mọi lần chạy e2e không ổn định đều có cùng một nguyên nhân gốc: mạng. Công cụ này ghi lại traffic thật một lần, rồi phát lại chúng từng byte trên CI — để test pass với backend đã tắt.

- **Không cần backend trên CI** — phát lại từ đĩa, không cần mạng.
- **Không cần mock thủ công** — ghi lại các tương tác thật, không bao giờ viết fixture bằng tay.
- **SSR + trình duyệt + WebSocket** — ghi lại ở bất cứ nơi nào request xuất phát.

## So sánh

test-proxy-recorder là công cụ ghi lại traffic **thật** trên cả SSR, trình duyệt, và WebSockets mà không cần mock viết tay — sự kết hợp đó chính là khoảng trống các công cụ khác để lại.

| Tính năng | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Ghi lại traffic thật | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Phía máy chủ (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Phía trình duyệt | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Thuần Playwright | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Được bảo trì | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js chặn HTTP của Node, nên việc mock SSR có thể thực hiện bên trong tiến trình ứng dụng, nhưng không phải như một phần của lần chạy Playwright. MSW và Mocky Balboa cũng phát lại các response thật — nhưng bạn phải viết mock bằng tay thay vì ghi lại chúng.

Xem [so sánh đầy đủ trong tài liệu](https://test-proxy-recorder.dev/docs/#comparison) — bao gồm cả khi nào nên chọn thứ khác.

## Bắt đầu nhanh

**Đường nhanh nhất — giao cho AI coding agent của bạn.** Sao chép đoạn này, thay URL backend của bạn vào, và dán vào Claude Code / Cursor / v.v. (nó chạy `init` và hoàn tất việc kết nối):

```text
# Set up test-proxy-recorder for end-to-end tests in this project, then follow the instructions that `init` prints. Run these commands:
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# Then complete the steps init prints: point the app's API base URL at the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test, and verify record → replay.
```

Thích tự kết nối bằng tay hơn:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` dựng mọi thứ một cách không phá hoại: cấu hình proxy, một Playwright fixture, một global teardown, script `package.json`, và (trên Next.js) kết nối việc gắn thẻ fetch SSR vào root layout của bạn qua `registerProxyFetch()`. Nó kết thúc bằng cách in ra một prompt AI-agent tùy chỉnh cho các bước riêng của ứng dụng mà nó không thể đoán.

Điều duy nhất `init` không thể đoán là biến env nào chứa base URL API của bạn. Trỏ nó về proxy khi recorder được bật, về backend thật trong trường hợp còn lại — proxy không bao giờ chạy trong production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // địa chỉ proxy từ `init`
```

Sau đó đặt `MODE = 'record'`, chạy một lần dựa trên API thật, lật sang `'replay'`, và commit `e2e/recordings/`. CI giờ chạy với backend đã tắt.

Hướng dẫn đầy đủ: [bắt đầu nhanh](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [thiết lập thủ công](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **Nó vừa giúp bạn tiết kiệm một buổi chiều viết mock bằng tay phải không?**
> Một [⭐ trên GitHub](https://github.com/asmyshlyaev177/test-proxy-recorder) chỉ mất một giây và là cách người tiếp theo đang vật lộn với test e2e không ổn định tìm thấy công cụ này. Tôi là maintainer độc lập và xem mỗi star như một tín hiệu để tiếp tục.

## Ví dụ

Các ứng dụng hoàn chỉnh và chạy được trong [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), mỗi cái có README riêng:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + trình duyệt + chat WebSocket
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — `registerProxyFetch` để phát lại đồng thời
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + trình duyệt, TanStack Query, ISR, WebSocket, và một đăng nhập Cognito thật
- [Extension Chrome](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — chỉ chạy trên trình duyệt, phát lại offline
- [Crypto ticker](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — feed WebSocket bên thứ ba
- [Ứng dụng xác thực](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — đăng nhập Cognito thật, API được bảo vệ được phát lại

## Tài liệu

Mọi thứ khác nằm ở [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/): [cách thức hoạt động](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [cấu hình](https://test-proxy-recorder.dev/docs/guides/config/), [loại bỏ bí mật](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [tích hợp Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [tích hợp TanStack Start](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [tham chiếu API](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

Đang dùng AI coding agent? `npx @tanstack/intent@latest install` thêm các skill để nó tạo mã thiết lập đúng đắn. Xem [hướng dẫn skill cho AI agent](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Yêu cầu

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (peer dependency)

## Phản hồi & đóng góp

Công cụ này được xây dựng và bảo trì công khai bởi một người, và mọi phản hồi đều định hướng thứ sẽ được xây dựng tiếp theo:

- **[⭐ Star repo](https://github.com/asmyshlyaev177/test-proxy-recorder)** — cách nhanh nhất để ủng hộ, và nó thực sự giúp người khác khám phá công cụ này.
- **Gặp chỗ khó hay có ý tưởng?** [Mở một issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) hoặc chào hỏi trong [Discord](https://discord.gg/w7rgYbY5zz) — ngay cả một dòng "chỗ này làm tôi bối rối" cũng quý giá.
- **Muốn đóng góp?** Rất hoan nghênh PR. 

## Skill AI

Đang dùng AI coding agent (Claude Code, Cursor, Copilot, …)? Thư viện đi kèm các skill [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) để agent tạo mã thiết lập đúng đắn. Cài package, rồi viết hướng dẫn cho agent:

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` thêm hướng dẫn khám phá skill vào cấu hình agent của bạn (`CLAUDE.md`, `.cursorrules`, …); agent nạp các skill `proxy-setup`, `nextjs-ssr`, và `tanstack-start` theo yêu cầu. Liệt kê hoặc nạp chúng trực tiếp bằng `npx @tanstack/intent@latest list` và `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`. Hướng dẫn đầy đủ: [skill cho AI agent](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

Nguồn các skill nằm trong [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/).

## Thuê tôi

Tôi là **Aleksandr Smyshliaev** — tác giả và maintainer của công cụ này. Senior
frontend engineer (React / Next.js / TypeScript, 8+ năm kinh nghiệm), và **sẵn sàng
nhận việc full-time remote ngay bây giờ**.

Dự án này tồn tại vì tôi đã dành nhiều năm sửa các bộ test không ổn định của
người khác. Đó là loại công việc tôi giỏi nhất: hạ tầng nhàm chán quyết định
liệu một codebase còn dễ chịu sau sáu tháng hay không.

- **Giỏi nhất ở** — thư viện component, quản lý state, và các bộ test sống sót
  qua một lần refactor.
- **Cũng là của tôi** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (~84k lượt cài hàng tuần),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (state URL có kiểu),
  [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **Ở đâu** — Tbilisi, Georgia (GMT+4), trùng khớp toàn bộ CET. Đã đăng ký thực thể
  contractor, nên hợp tác B2B không cần thiết lập employer-of-record.
- **Liên hệ** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## Giấy phép

MIT
