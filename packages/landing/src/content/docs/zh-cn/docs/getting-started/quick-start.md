---
title: 快速开始
description: 一条 init 命令即可搭建 test-proxy-recorder —— 内置 Next.js SSR 中间件。把你的 API 指向代理，录制一次，在 CI 中回放。
---

## 1. 搭建

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

它会写入所有内容，但绝不覆盖任何已有文件：

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # 仅 Next.js —— SSR 中间件
e2e/fixtures.ts          # record vs replay
e2e/global-teardown.ts
package.json             # + proxy / test:e2e 脚本
```

## 2. 把应用的 API 指向代理

`init` 唯一猜不到的事情：哪个环境变量保存着你的 API 基础 URL。在录制器启用时把它指向代理，其余情况指向真实后端 —— 代理绝不在生产环境中运行：

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init` 给出的代理地址
```

## 3. 录制一次，永远回放

```bash
# fixtures.ts: MODE = 'record' —— 捕获真实响应
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' —— 然后提交录制内容
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

现在 CI 在后端关闭的情况下回放 —— 每次都是相同的响应。

---

想手动接入，或需要了解细节？参见[手动配置](/zh-cn/docs/getting-started/manual-setup/)和[工作原理](/zh-cn/docs/getting-started/how-it-works/)。
