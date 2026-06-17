---
title: AI 代理技能
description: 安装 test-proxy-recorder 的技能，让 AI 编码代理（Claude Code、Cursor、Copilot）生成正确的配置代码。
---

如果你使用 AI 编码代理（Claude Code、Cursor、Copilot 等），请为本库安装技能，让代理生成正确的配置代码：

```bash
npx @tanstack/intent@latest install
```

这会把 `test-proxy-recorder` 的技能加入你的项目。随后代理无需指引即可掌握正确的代理/fixture 配置、record 与 replay 工作流，以及 Next.js 的 SSR header 模式。

## 维护这些技能（面向贡献者）

代理技能位于 [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills)。请定期检查 —— 并在库的 API 或示例变更时检查：

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` 必须通过；`stale` 仅作参考 —— 当它在发布后报告漂移时，请重新审阅受影响技能的内容（并提升其 `library_version`）。
