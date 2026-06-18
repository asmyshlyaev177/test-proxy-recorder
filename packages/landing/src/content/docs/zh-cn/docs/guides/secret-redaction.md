---
title: 机密涂抹
description: 涂抹默认开启 —— Authorization、Cookie 和 Set-Cookie 会在写入磁盘前从录制中去除。可添加 header 和 body 模式、放行 cookie，或以编程方式涂抹。
---

录制会被提交到 git，所以在向磁盘写入任何内容之前会先去除机密。涂抹**默认开启**；代理会把下列请求/响应 header 的值替换为 `[REDACTED]`：

- `Authorization`
- `Cookie`
- `Set-Cookie`

这是安全的：回放时的匹配会忽略这些 header，所以涂抹绝不会破坏回放。它适用于 `.mock.json` 录制、WebSocket 录制和 `.har` 文件。要关闭涂抹，在 CLI 上传入 `--no-redact`，或在[配置](/zh-cn/docs/guides/config/)中设置 `redaction: false`。

当只有*部分* cookie 敏感时，按名称放行无害的那些（例如 `theme` 或 A/B 测试 cookie）。被放行的 cookie 会在 `Cookie`/`Set-Cookie` 中保留其值；其余 cookie 仍会被涂抹。

:::note[`.har` 文件如何被涂抹]
`.har` 文件由 Playwright 的 `routeFromHAR` 写入，而非代理，因此它们会在单独的一次处理中被涂抹。`playwrightProxy.teardown()` 会使用与代理**相同的涂抹配置**（header、`allowCookies` 和 `bodyPatterns` 都适用，并同时作用于 header 和解析后的 `cookies` 数组），重写录制目录中的每个 `.har`。它从你的 Playwright **`globalTeardown`** 中运行 —— 因此 HAR 涂抹需要一个调用 `playwrightProxy.teardown()` 的 `globalTeardown`（即 `init` 生成的[推荐配置](/zh-cn/docs/integrations/playwright/#global-teardown-recommended)）。

它无法按测试运行：Playwright 在其 context 关闭时会刷新 HAR，但不会等待关闭处理器，因此在那里涂抹会与进程退出竞争，可能截断文件。teardown 会从 `/__control` 获取配置（代理必须在运行；若无法访问，仍会应用内置的 header 默认值），只重写它实际更改过的文件，并保持 base64 的响应体不变。出于纵深防御，仍应使用短期有效的测试凭据进行录制，并在提交前检查 HAR —— 参见下方推荐的认证模式。
:::

## 推荐的认证模式

要把登录流程和凭据完全排除在录制之外，请在一个将代理设为 `transparent` 模式的 Playwright **setup project** 中执行认证，把 `storageState` 持久化到一个 **被 gitignore 的** `auth-state.json`，并在测试中复用它。这样被录制的请求只携带（已涂抹的）会话 header，而绝不包含登录。

针对真实认证提供方的可运行配置，请参见[认证应用示例](/zh-cn/docs/reference/examples/#authenticated-app)。

## 调整涂抹内容

默认 header 始终适用（在涂抹开启时）；你可以在其基础上追加。

### CLI 标志

- `--no-redact` —— 关闭机密涂抹（默认开启）。
- `--redact` —— 开启机密涂抹；仅当配置设置了 `redaction: false` 时，用于重新开启。
- `--redact-headers <names>` —— 额外要涂抹的 header 名（逗号分隔，与默认值合并）。
- `--redact-body <patterns>` —— 要从请求/响应 body 中涂抹的正则模式（逗号分隔）。
- `--allow-headers <names>` —— 免于涂抹的 header 名（逗号分隔，例如 `set-cookie`）。
- `--allow-cookies <names>` —— 在 `Cookie`/`Set-Cookie` 中保持不涂抹的 cookie 名（逗号分隔）。

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### 以编程方式

当直接构造 `ProxyServer` 时：

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

如果你想自己涂抹已有的录制，还可以使用导出的 `redactSession(session, config)`。
