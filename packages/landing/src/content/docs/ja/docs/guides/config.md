---
title: 設定ファイル
description: test-proxy-recorder のオプション — ターゲット、ポート、編集用の正規表現、WebSocket のペース — を CLI フラグの代わりに自動検出される設定ファイルに記述します。
---

数個のフラグを超えるもの — 特にボディ編集の正規表現 — は、設定ファイルにオプションを記述してください。プロキシはカレントディレクトリの `test-proxy-recorder.config.{ts,js,mjs,cjs}` を自動検出します。あるいは `--config <path>` で明示的に指定します。`.ts` ファイルはそのまま動作します。

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

## 優先順位

各オプションは **CLI フラグ → 設定ファイル → 組み込みデフォルト** の順で解決されます。コマンドラインで渡したフラグは常に設定ファイルを上書きし、省略したものは設定ファイル、次にデフォルトにフォールバックします。（`--redact-headers` のようなリスト系フラグは、設定ファイルのリストをマージするのではなく*置き換え*ます — 上書きしたいときだけ渡してください。）`target` は CLI 引数としても、設定の `target` としても指定でき、両方ある場合は引数が優先されます。

`Config` 型の全体は [API リファレンス](/docs/reference/api/interfaces/config/)を参照してください。
