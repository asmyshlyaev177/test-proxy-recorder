---
title: 快速开始
description: 一条 init 命令即可搭建 test-proxy-recorder —— 最好由 AI agent 驱动。把你的 API 指向代理，录制一次，在 CI 中回放。
---

## 用 AI agent 搭建（推荐）

把下面这段复制粘贴给你的 AI 编码 agent（Claude Code、Cursor、……）：

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

agent 会添加 skills，用 `init` 脚手架生成所有内容（配置、Playwright fixture、teardown、scripts，以及 —— 在 Next.js 上 —— 在你的 root layout 中加入 `registerProxyFetch()`），然后完成 `init` 自己无法从它打印的提示中猜到的接线。想要一份可直接复制的成品？参见[示例](/zh-cn/docs/reference/examples/)。

## 或者手动接线

`init` 写入所有内容，但绝不覆盖任何已有文件：

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # 仅 Next.js —— 加入 registerProxyFetch() 给 SSR fetch 打标
e2e/fixtures.ts          # record vs replay
e2e/global-teardown.ts
package.json             # + proxy / test:e2e 脚本
```

### 1. 把应用的 API 指向代理

`init` 唯一猜不到的事情：哪个环境变量保存着你的 API 基础 URL。在录制器启用时把它指向代理，其余情况指向真实后端 —— 代理绝不在生产环境中运行：

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init` 给出的代理地址
```

### 2. 给服务端 fetch 打标（仅 Next.js）

浏览器请求已经携带 recording-session id（由 Playwright 设置）。对于服务端 fetch（SSR、Server Components），在你的 root layout 中加一行让它们也带上标 —— `init` 会替你做这件事：

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // production 下是 no-op，除非 TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

服务端调用用的是 axios？改用 `registerProxyAxios(instance)`。请针对 production build 录制（`next build && next start`），而不是 `next dev`。纯浏览器应用（SPA、扩展）可以跳过这一步。

### 3. 录制一次，永远回放

```bash
# fixtures.ts: MODE = 'record' —— 捕获真实响应
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' —— 然后提交录制内容
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

现在 CI 在后端关闭的情况下回放 —— 每次都是相同的响应。

---

更多细节：[手动配置](/zh-cn/docs/getting-started/manual-setup/) · [工作原理](/zh-cn/docs/getting-started/how-it-works/) · [AI agent skills](/zh-cn/docs/reference/ai-agent-skills/)。
