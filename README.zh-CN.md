<!-- i18n:start -->
[English](./README.md) · 简体中文 · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=zh-CN source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **Playwright 的 VCR（录像机）** —— 录制一次真实 API 响应，然后在 CI 上逐字节地确定性回放。覆盖 Next.js 与 TanStack Start SSR、浏览器以及 WebSocket 流量。无需后端，无需手写 mock。

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="录制真实 API 响应，然后在关闭后端的情况下在 CI 上回放" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## 为什么

每次不稳定的 e2e 运行都有同一个根本原因：网络。本工具录制一次真实流量，然后在 CI 上逐字节地回放 —— 因此测试在后端关闭的情况下也能通过。

- **CI 上无需后端** —— 从磁盘回放，无需网络。
- **无需手写 mock** —— 捕获真实交互，绝不手写 fixture。
- **SSR + 浏览器 + WebSocket** —— 无论请求从哪里发起都能录制。

## 对比

test-proxy-recorder 是唯一一个在不手写 mock 的情况下，跨 SSR、浏览器和 WebSocket 录制**真实**流量的工具 —— 这一组合正是其他工具留下的空白。

| 特性 | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 录制真实流量 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 服务端（SSR） | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| 浏览器端 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Playwright 原生 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 维护中 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js 拦截 Node HTTP，所以 SSR mock 可以在应用进程内部实现，但无法作为 Playwright 运行的一部分。MSW 和 Mocky Balboa 也能回放真实响应 —— 但你需要手写 mock，而不是录制它们。

参见[文档中的完整对比](https://test-proxy-recorder.dev/docs/#comparison) —— 包括何时改用其他工具。

## 快速开始

**最快路径 —— 交给你的 AI 编码代理。** 复制这段内容，换成你的后端 URL，然后粘贴到 Claude Code / Cursor / 等工具中（它会运行 `init` 并完成接线）：

```text
# 在本项目中为端到端测试搭建 test-proxy-recorder，然后按照 `init` 打印的说明操作。运行以下命令：
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# 然后完成 init 打印的步骤：仅在 dev/test 中将应用的 API 基础 URL 指向代理，给服务端 fetch 打标（Next.js），添加一个 smoke 测试，并验证录制 → 回放。
```

更愿意手动接线：

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` 以非破坏方式脚手架生成所有内容：代理配置、一个 Playwright fixture、一个全局 teardown、`package.json` 脚本，以及（在 Next.js 上）通过 `registerProxyFetch()` 把 SSR fetch 打标接入你的 root layout。最后它会打印一份针对应用特定步骤量身定制的 AI-agent 提示，因为这些步骤它无法猜测。

`init` 唯一猜不到的事情是哪个环境变量保存着你的 API 基础 URL。在录制器启用时把它指向代理，其余情况指向真实后端 —— 代理绝不在生产环境中运行：

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init` 给出的代理地址
```

然后把 `MODE` 设为 `'record'`，针对真实 API 运行一次，翻转到 `'replay'`，再提交 `e2e/recordings/`。现在 CI 在后端关闭的情况下运行。

完整教程：[快速开始](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [手动配置](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/)。

> **刚才是不是省下了你一下午手写 mock 的时间？**
> 在 [GitHub 上点一颗 ⭐](https://github.com/asmyshlyaev177/test-proxy-recorder) 只需要一秒钟，也是下一个与不稳定的 e2e 测试搏斗的人找到本工具的方式。我是唯一的维护者，把每一颗 star 都当作继续做下去的信号。

## 示例

完整的可运行应用位于 [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps)，每个都有自己的 README：

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) —— SSR + 浏览器 + WebSocket 聊天
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) —— 用 `registerProxyFetch` 支持并发回放
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) —— SSR + 浏览器、TanStack Query、ISR、WebSocket，以及一次真实的 Cognito 登录
- [Chrome 扩展](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) —— 纯浏览器，离线回放
- [加密货币行情](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) —— 第三方 WebSocket 数据源
- [认证应用](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) —— 真实的 Cognito 登录，受保护的 API 被回放

## 文档

其余内容都在 [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/)：[工作原理](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/)、[CLI](https://test-proxy-recorder.dev/docs/guides/cli/)、[配置](https://test-proxy-recorder.dev/docs/guides/config/)、[机密涂抹](https://test-proxy-recorder.dev/docs/guides/secret-redaction/)、[Next.js 集成](https://test-proxy-recorder.dev/docs/integrations/nextjs/)、[TanStack Start 集成](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/)、[API 参考](https://test-proxy-recorder.dev/docs/reference/api/readme/)、[FAQ](https://test-proxy-recorder.dev/docs/reference/faq/)。

在使用 AI 编码代理？`npx @tanstack/intent@latest install` 会添加技能，让它生成正确的配置代码。参见 [AI agent 技能指南](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/)。

## 环境要求

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0（peer dependency）

## 反馈与贡献

本工具由一个人公开构建和维护，每一条反馈都会影响接下来要构建什么：

- **[⭐ 为仓库加星](https://github.com/asmyshlyaev177/test-proxy-recorder)** —— 支持它的最快方式，也确实能帮助他人发现它。
- **遇到了麻烦或有想法？** [提交 issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) 或到 [Discord](https://discord.gg/w7rgYbY5zz) 打个招呼 —— 即使是一句“这里把我搞糊涂了”也很有价值。
- **想贡献？** 欢迎提交 PR。

## AI 技能

在使用 AI 编码代理（Claude Code、Cursor、Copilot、……）？本库随附 [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) 技能，让代理生成正确的配置代码。先安装包，再编写 agent 指引：

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` 会把技能发现指引写入你的 agent 配置（`CLAUDE.md`、`.cursorrules`、……）；agent 会按需加载 `proxy-setup`、`nextjs-ssr` 和 `tanstack-start` 技能。可以用 `npx @tanstack/intent@latest list` 和 `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup` 直接列出或加载它们。完整指南：[AI agent 技能](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/)。

技能源码位于 [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/)。

## 雇用我

我是 **Aleksandr Smyshliaev** —— 本工具的作者与维护者。资深前端工程师（React / Next.js / TypeScript，8+ 年经验），目前**可接受全职远程工作**。

这个项目源于我多年来一直在修复别人不稳定的测试套件。那正是我最擅长的工作：决定一个代码库在半年后是否仍然令人愉悦的无聊基础设施。

- **最擅长** —— 组件库、状态管理，以及经得起重构的测试套件。
- **也是我的项目** ——
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  （每周约 84k 次安装）、
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url)（带类型的 URL
  状态）、[llm-queue](https://github.com/asmyshlyaev177/llm-queue)。
- **所在地** —— 格鲁吉亚第比利斯（GMT+4），与 CET 完全重叠。已注册为承包商
  实体，因此 B2B 合作无需雇主记录（employer-of-record）设置。
- **联系我** —— [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## 许可证

MIT
