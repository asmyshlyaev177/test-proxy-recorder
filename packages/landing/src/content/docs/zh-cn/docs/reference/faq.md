---
title: 常见问题
description: 关于 test-proxy-recorder 的常见问题 —— 并行回放、把录制提交到 git、HAR 录制的代理目标、Next.js 开发服务器，以及如何更新录制。
---

## 我的并行回放测试有时会访问真实后端 —— 为什么？{#parallel-replay}

你很可能在每个测试的钩子里调用了 `playwrightProxy.teardown()`。它会把代理的**全局**模式设为 `transparent`，而在 `fullyParallel: true` 下，每个 Playwright worker 都会运行自己的 `test.afterAll`。如果一个快的测试结束并调用 `teardown()`，而一个较慢的测试仍在运行，代理就会在测试中途切到 transparent，剩余请求便会被转发到真实后端，而不是被回放。

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**解决办法：** 省略 `test.afterAll`。会话清理会通过 `context.on('close')` → `cleanupSession()` 自动完成。仅当你需要在整个运行结束后重置代理时，才使用 [global teardown](https://playwright.dev/docs/test-global-setup-teardown)。

## 我应该把录制提交到 git 吗？

应该。录制必须在 git 中，CI 才能在无网络下回放 —— **不要**把 `e2e/recordings` 加入 `.gitignore`。为避免较大的录制文件让 PR diff 膨胀，在 `.gitattributes` 中把它们标记为二进制：

```text
/e2e/recordings/** binary
```

## 对纯浏览器（HAR）录制而言，代理的 `<target-url>` 重要吗？

不重要。对纯浏览器录制，目标无关紧要 —— 代理进程只需运行，使其 `/__control` 端点可用于会话管理即可。只有在服务端（SSR）请求也经由代理路由时，目标才重要。

## 我能对 Next.js 开发服务器录制吗？

录制和回放时，相较 `next dev` 更推荐 `next build` + `next start`。开发服务器较慢，可能导致超时或不稳定的录制。

## 如何更新一份录制？

在 record 模式下重新运行（在 fixture 中设 `MODE = 'record'`，或设 `RECORD_MODE=1`）对真实 API 录制，然后切回 replay 并提交 `e2e/recordings/` 中更新后的文件。
