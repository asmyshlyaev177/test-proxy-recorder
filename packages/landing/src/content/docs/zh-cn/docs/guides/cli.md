---
title: CLI
description: test-proxy-recorder 的命令行界面 —— 选项、WebSocket 回放节奏，以及如何重置卡住的代理。
---

```bash
test-proxy-recorder <target-url> [options]
```

| 选项             | 默认值         | 说明                                |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(必填)*       | 要代理的后端 URL                    |
| `--port, -p`     | `8000`         | 代理监听端口                        |
| `--dir, -d`      | `./recordings` | 录制文件目录                        |
| `--timeout, -t`  | `120000`       | 会话自动重置超时（毫秒）            |
| `--config, -c`   | *(自动)*       | 配置文件路径                        |
| `--ws-timing`    | `burst`        | WebSocket 回放节奏 —— `burst` 或 `original` |

机密涂抹（redaction）**默认开启** —— Authorization/Cookie/Set-Cookie 会被自动从录制中去除。用 `--no-redact`，或在[配置](/zh-cn/docs/guides/config/)中设 `redaction: false` 关闭。`--redact-headers` 和 `--redact-body` 等用于追加涂抹内容的标志，请参见[机密涂抹](/zh-cn/docs/guides/secret-redaction/)。

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## WebSocket 回放节奏

默认情况下，录制的 WebSocket 服务端消息会在连接时以**突发**（`burst`）方式回放 —— 最快且完全确定，非常适合 CI。传入 `--ws-timing original`（或配置中的 `websocket: { timing: 'original' }`）可改为按录制的时间戳重新排期，使消息以真实的间隔到达；这样一个测试大致会耗费录制的真实时长。

你也可以通过 `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })` **按测试**设置，它仅对该会话覆盖代理级别的默认值。

## 重置卡住的代理

代理会在每个会话超时后自动恢复到 `transparent`，`globalTeardown` 也会在一次干净运行结束时重置它。但**被中断的**运行（`Ctrl+C`）、UI/调试会话，或没有 `globalTeardown` 的配置，都可能让共享代理卡在 `record`/`replay` —— 于是你的应用会继续提供录制的响应，而不是访问真实后端。可按需重置：

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

它会向 `/__control` 发送 `{ "mode": "transparent" }` POST —— 这是用 `curl` 手动重置的受支持、并行安全的替代方案。随时运行都安全：无法访问的代理会被当作无操作。端口的解析顺序为 **`--port` 标志 → 环境变量 `TEST_PROXY_RECORDER_PORT` → 配置文件 → `8000`**，因此它会指向代理启动时所用的端口（用 `--port` / `--config` 覆盖）。`init` 会把它生成为 `proxy:reset` 脚本。

## `init` —— 生成配置

使用 `npx test-proxy-recorder init` 的推荐一键配置，请参见[快速开始](/zh-cn/docs/getting-started/quick-start/)。
