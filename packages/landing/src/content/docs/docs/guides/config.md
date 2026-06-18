---
title: Config file
description: Put test-proxy-recorder options — target, port, redaction regexes, WebSocket pacing — in an auto-discovered config file instead of CLI flags.
---

For anything beyond a couple of flags — especially body-redaction regexes — put the options in a config file instead. The proxy auto-discovers `test-proxy-recorder.config.{ts,js,mjs,cjs}` in the current directory, or pass `--config <path>` to point at one explicitly. `.ts` files work out of the box.

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

## Precedence

Every option resolves as **CLI flag → config file → built-in default**. A flag you pass on the command line always overrides the config file; anything you omit falls back to the config, then the default. (List flags like `--redact-headers` *replace* the config's list rather than merging — pass it only when you want to override.) `target` may be given as the CLI argument or as `target` in the config; the argument wins when both are present.

See the [API reference](/docs/reference/api/interfaces/config/) for the full `Config` type.
