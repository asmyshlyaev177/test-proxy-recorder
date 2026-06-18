---
title: 快速开始
description: 用一条 init 命令将 test-proxy-recorder 接入项目，然后录制一次并在 CI 中回放。
---

安装：

```bash
npm install --save-dev test-proxy-recorder
```

## 最快方式：用 `init` 生成

一条命令即可将 test-proxy-recorder 接入项目：

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

所有参数都是可选的，会回退到合理的默认值（`http://localhost:3000`、端口 `8100`、`./e2e/recordings`）。它以**非破坏性**方式生成和编辑文件 —— 除非你传入 `--force`，否则绝不覆盖已有文件和脚本。

### `init` 生成和编辑哪些内容

- `test-proxy-recorder.config.ts` —— 代理配置（会被自动发现，因此之后运行 `npx test-proxy-recorder` 无需任何参数）。
- `playwright.config.ts` —— 添加一个指向代理 `/__control` 端点的 `webServer`，以及一个 `globalTeardown`。已有的 Playwright 配置会被**就地编辑**；如果你完全没有 Playwright，`init` 会先运行 Playwright CLI 进行配置（传入 `--no-install` 可跳过）。
- `e2e/fixtures.ts` 和 `e2e/global-teardown.ts` —— 每个测试的代理 fixture 和 teardown。
- `package.json` —— 添加 `proxy`、`proxy:reset`、`test:e2e` 和 `test:e2e:record` 脚本。如果你有 `dev` 脚本，它会被包装：原来的脚本移到 `dev:app`，`dev` 变成一个 `concurrently` 命令，与你的应用一起运行代理（这样 `npm run dev` 会在开发时进行录制）。`concurrently` 会被加入 `devDependencies`。

已经定义了 `webServer` 的 Playwright 配置会保持不变，并附上需要添加内容的说明。

## 唯一的手动步骤

**`init` 无法替你完成的唯一步骤**是把应用的后端调用路由到代理 —— 哪个环境变量保存你的 API 基础 URL、以及如何将其限定在开发环境，都因应用而异。`init` 完成时会为此打印具体说明：把那个环境变量指向 `http://localhost:8100`，**仅在开发/测试中，绝不要在生产环境**（例如在 `dev:app` 脚本前加前缀，Windows 上用 `cross-env`）。随后代理会在录制时转发到你真实的后端，并在回放时提供录制内容。

接着编写一个测试，对真实 API 录制一次，切换到回放，并提交 `e2e/recordings/`。[手动配置](/zh-cn/docs/getting-started/manual-setup/)完整展示了这一循环。
