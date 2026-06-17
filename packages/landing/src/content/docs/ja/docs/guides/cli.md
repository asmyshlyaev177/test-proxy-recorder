---
title: CLI
description: test-proxy-recorder のコマンドラインインターフェース — オプション、WebSocket の再生ペース、スタックしたプロキシのリセット方法。
---

```bash
test-proxy-recorder <target-url> [options]
```

| オプション        | デフォルト     | 説明                                |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(必須)*       | プロキシするバックエンド URL        |
| `--port, -p`     | `8000`         | プロキシのリッスンポート            |
| `--dir, -d`      | `./recordings` | 記録ファイルのディレクトリ          |
| `--timeout, -t`  | `120000`       | セッション自動リセットのタイムアウト (ms) |
| `--config, -c`   | *(自動)*       | 設定ファイルのパス                  |
| `--ws-timing`    | `burst`        | WebSocket の再生ペース — `burst` または `original` |

シークレットの編集（redaction）は**デフォルトで有効**です — Authorization/Cookie/Set-Cookie は記録から自動的に取り除かれます。`--no-redact`、または[設定](/ja/docs/guides/config/)で `redaction: false` にして無効化できます。編集対象を追加する `--redact-headers` と `--redact-body` フラグについては[シークレットの編集](/ja/docs/guides/secret-redaction/)を参照してください。

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## WebSocket の再生ペース

デフォルトでは、記録された WebSocket のサーバーメッセージは接続時に**バースト**（`burst`）で再生されます — 最速で完全に決定論的、CI に最適です。`--ws-timing original`（または設定の `websocket: { timing: 'original' }`）を渡すと、記録されたタイムスタンプを使って再生し、メッセージは実際のメッセージ間隔で届きます。その場合テストは概ね記録の実時間分かかります。

これは `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })` で**テストごと**に設定することもでき、そのセッションのみプロキシレベルのデフォルトを上書きします。

## スタックしたプロキシをリセットする

プロキシは各セッションのタイムアウト後に自動的に `transparent` へ戻り、`globalTeardown` はクリーンな実行の最後にリセットします。しかし**中断された**実行（`Ctrl+C`）、UI/デバッグセッション、または `globalTeardown` のない設定では、共有プロキシが `record`/`replay` のままスタックすることがあります — その結果、アプリは実際のバックエンドを呼ばずに記録済みレスポンスを提供し続けます。必要に応じてリセットしてください:

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

これは `/__control` に `{ "mode": "transparent" }` を POST します — `curl` で手動リセットする代わりの、サポートされた並列安全な手段です。いつでも安全に実行できます: 到達不能なプロキシは no-op として扱われます。ポートは **`--port` フラグ → 環境変数 `TEST_PROXY_RECORDER_PORT` → 設定ファイル → `8000`** の順で解決され、プロキシが起動したポートを対象とします（上書きするには `--port` / `--config`）。`init` はこれを `proxy:reset` スクリプトとして生成します。

## `init` — セットアップを生成する

`npx test-proxy-recorder init` による推奨の 1 コマンドセットアップは[クイックスタート](/ja/docs/getting-started/quick-start/)を参照してください。
