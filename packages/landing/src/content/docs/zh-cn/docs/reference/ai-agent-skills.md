---
title: AI 代理技能
description: 安装 test-proxy-recorder 的技能，让 AI 编码代理（Claude Code、Cursor、Copilot）生成正确的 proxy、fixture 和 SSR 配置代码。
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

如果你使用 AI 编码代理（Claude Code、Cursor、Copilot 等），请设置技能加载，让代理生成正确的配置代码。这些技能通过 [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) 随 `test-proxy-recorder` 包一起发布，并跟随你常规的包管理器更新一同分发。

**1. 安装库**（技能会从已安装的包中发现）：

```bash
npm install --save-dev test-proxy-recorder
```

**2. 编写 agent 指引** —— `install` 会把发现指令写入你的 agent 配置（`CLAUDE.md`、`.cursorrules` 等），使 agent 按需加载匹配的包技能：

```bash
npx @tanstack/intent@latest install
```

如果你更希望在 agent 配置中显式写入任务到技能的映射，而不是通用的发现指引，可传入 `--map`。

随后 agent 无需任何指引即可掌握正确的代理/fixture 配置、录制与回放工作流，以及 Next.js 的 SSR header 模式。

## 技能

`test-proxy-recorder` 附带以下技能：

- **`proxy-setup`** —— 代理 CLI、`package.json` 脚本、`playwright.config.ts` 的 `webServer`、按测试的 fixture、record/replay/transparent 模式、机密涂抹，以及“录制一次 → 提交 → CI 回放”的完整生命周期。
- **`nextjs-ssr`** —— 用 `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId` 给服务端 fetch 打标、build-and-start 与 `next dev` 的注意事项，以及为什么中间件是可选的。
- **`tanstack-start`** —— 给 TanStack Start 的 loaders、server functions 和 server routes 打标、build 与 `vite dev` 的注意事项、服务端与浏览器端 API URL 的区分、TanStack Query SSR 预取，以及真实认证模式。

列出已安装包中可用的技能，或直接加载某一个：

```bash
npx @tanstack/intent@latest list                          # 列出可发现的技能
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## 维护技能（面向贡献者）

代理技能位于 [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills)。请定期检查 —— 并在库的 API 或示例变更时检查：

```bash
npx @tanstack/intent@latest validate   # 结构/格式/行数限制检查（在提交技能修改前运行）
npx @tanstack/intent@latest stale      # 标记与已发布库之间的版本漂移 —— 重新审阅它列出的技能
```

`validate` 必须通过；`stale` 仅作参考 —— 当它在发布后报告漂移时，请重新审阅受影响技能的内容（并提升其 `library_version`）。
