---
title: コントロールエンドポイント
description: プロキシは /__control を公開し、transparent・record・replay のモードをプログラムから切り替えられます。
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

プロキシはプログラムからモードを切り替えるために `/__control` を公開しています。

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // required unless cleanup is true
  id?: string;       // required for record/replay (and for cleanup)
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

ほとんどのセットアップでは、これを直接呼ぶことはありません — `playwrightProxy.before()` と `setProxyMode()`（[API リファレンス](/docs/reference/api/readme/)参照）が代わりに POST します。シェル、CI のステップ、AI エージェントからプロキシを操作するときに `/__control` を使ってください。

## セッション

プロキシは、再生と同様に記録モードでもテストの id ごとに 1 つのセッションを保持するため、並列のワーカーで動くテストは 1 つのプロキシを共有できます。各リクエストは、`x-test-rcrd-id` ヘッダー、またはブラウザの WebSocket ハンドシェイクでは `proxy-recording-id` クッキーで指定されたセッションに振り分けられます。バージョン 2.0.1 までは、すべてのリクエストに対して 1 つの記録セッションを保持していました。

- **`{"mode": "record", "id": "my-test-1"}`** はそのセッションの記録を開始します。すでに記録中のセッションはそのまま記録を続けます。
- **`{"id": "my-test-1", "cleanup": true}`** はそのセッションだけに作用します。再生セッションは閉じられます。記録セッションは `.mock.json` に保存され、`transparent` に切り替わるまでは、そのセッションを指定するリクエストを引き続き記録します。そのため、そのテストから遅れて届いたリクエストも保存されます。
- **`{"mode": "transparent"}`** はすべてのセッションを保存して終了するため、すべてのリクエストがそのままターゲットへ転送されます。`playwrightProxy.teardown()` がこれを送信します。`timeout` が切れたときもモードタイマーが同じことを行い、切り替えのたびにタイマーは再スタートします。

セッションを指定しないリクエストは、実行中の唯一のセッションに振り分けられます。複数のセッションが実行中の場合、プロキシは記録でも再生でも 400 で応答し、ボディの `activeSessions` に実行中の id を列挙します。実行中のセッションがない場合、リクエストは最後の切り替えに従います。

## 現在の状態

`GET /__control` は次を返します:

- `recordingsDir`: 記録の書き込み先ディレクトリ。
- `mode` と `id`: 最後の切り替えの内容。
- `redaction`: [マスキング](/ja/docs/guides/secret-redaction/)の設定。マスキングが無効なときは `false`。`playwrightProxy.teardown()` はこれを読んで `.har` ファイルをマスキングします。
- `sessions`: 現在記録中の id。
