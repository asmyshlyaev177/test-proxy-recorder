---
title: 配置文件
description: 把 test-proxy-recorder 的选项 —— 目标、端口、涂抹正则、WebSocket 节奏 —— 放进一个会被自动发现的配置文件，而不是 CLI 标志。
---

只要超出寥寥几个标志 —— 尤其是 body 涂抹的正则 —— 就把选项放进配置文件。代理会在当前目录自动发现 `test-proxy-recorder.config.{ts,js,mjs,cjs}`，或用 `--config <path>` 明确指定。`.ts` 文件开箱即用。

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // Redaction is on by default; this object customizes it (use `redaction: false` to disable).
  redaction: {
    headers: ['x-api-key'],         // extra headers, merged with the defaults
    bodyPatterns: [/sk_live_\w+/g], // real RegExp literals — no CLI escaping
    allowCookies: ['theme'],        // keep these cookies unredacted
  },
  websocket: {
    timing: 'burst',                // 'burst' (default) or 'original' (re-paced)
  },
});
```

```bash
test-proxy-recorder                 # all options from the config file
test-proxy-recorder --port 9000     # config file, but CLI port wins
```

## 优先级

每个选项按 **CLI 标志 → 配置文件 → 内置默认值** 解析。命令行上传入的标志始终覆盖配置文件；你省略的项会回退到配置文件，再回退到默认值。（像 `--redact-headers` 这样的列表型标志会*替换*配置文件中的列表，而不是合并 —— 只在你想覆盖时才传它。）`target` 既可以作为 CLI 参数给出，也可以作为配置中的 `target`；两者都存在时以参数为准。

完整的 `Config` 类型请参见 [API 参考](/docs/reference/api/interfaces/config/)。
