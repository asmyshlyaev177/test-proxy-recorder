---
title: Skill cho AI agent
description: Cài các skill của test-proxy-recorder để AI coding agents (Claude Code, Cursor, Copilot) tạo mã thiết lập proxy, fixture, và SSR đúng đắn.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

Nếu bạn dùng AI coding agent (Claude Code, Cursor, Copilot, và tương tự), hãy thiết lập việc nạp skill để agent tạo mã thiết lập đúng đắn. Các skill được đóng gói bên trong package `test-proxy-recorder` qua [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) và đi kèm nó qua các bản cập nhật package-manager thông thường của bạn.

**1. Cài thư viện** (các skill được khám phá từ các package đã cài):

```bash
npm install --save-dev test-proxy-recorder
```

**2. Viết hướng dẫn cho agent** — `install` thêm hướng dẫn khám phá vào cấu hình agent của bạn (`CLAUDE.md`, `.cursorrules`, v.v.) để agent nạp các skill của package phù hợp theo yêu cầu:

```bash
npx @tanstack/intent@latest install
```

Truyền `--map` nếu bạn muốn viết các ánh xạ task-to-skill tường minh vào cấu hình agent thay vì hướng dẫn khám phá chung.

Khi đó agent sẽ biết thiết lập proxy/fixture đúng, quy trình ghi lại so với phát lại, và các pattern header SSR của Next.js mà không cần hướng dẫn.

## Các skill

`test-proxy-recorder` đi kèm các skill này:

- **`proxy-setup`** — CLI của proxy, script `package.json`, `webServer` trong `playwright.config.ts`, các fixture theo từng test, các chế độ record/replay/transparent, việc loại bỏ bí mật, và vòng đời ghi-một-lần → commit → phát-lại-trên-CI.
- **`nextjs-ssr`** — gắn thẻ các fetch phía máy chủ bằng `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, hạn chế build-and-start so với `next dev`, và tại sao middleware là tùy chọn.
- **`tanstack-start`** — gắn thẻ loaders, server functions, và server routes của TanStack Start, hạn chế build so với `vite dev`, sự phân tách API-URL server so với browser, SSR prefetch của TanStack Query, và pattern auth thật.

Liệt kê những gì có sẵn từ các package đã cài, hoặc nạp một skill trực tiếp:

```bash
npx @tanstack/intent@latest list                          # hiển thị các skill có thể khám phá
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## Bảo trì các skill (dành cho người đóng góp)

Các skill của agent nằm trong [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Kiểm tra chúng định kỳ — và bất cứ khi nào API của thư viện hoặc các ví dụ thay đổi:

```bash
npx @tanstack/intent@latest validate   # kiểm tra cấu trúc/định dạng/giới hạn dòng (chạy trước khi commit các chỉnh sửa skill)
npx @tanstack/intent@latest stale      # đánh dấu lệch version so với thư viện đã phát hành — xem lại các skill nó liệt kê
```

`validate` phải pass; `stale` mang tính tư vấn — khi nó báo lệch sau một bản phát hành, hãy xem lại nội dung skill bị ảnh hưởng (và tăng `library_version` của nó).
