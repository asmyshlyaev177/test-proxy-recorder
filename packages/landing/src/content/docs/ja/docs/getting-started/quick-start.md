---
title: クイックスタート
description: 1 つの init コマンドで test-proxy-recorder をプロジェクトに組み込み、一度記録して CI で再生します。
---

インストール:

```bash
npm install --save-dev test-proxy-recorder
```

## 最速: `init` で生成する

1 つのコマンドで test-proxy-recorder をプロジェクトに組み込みます:

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

すべての引数は省略可能で、妥当なデフォルト（`http://localhost:3000`、ポート `8100`、`./e2e/recordings`）にフォールバックします。ファイルの生成・編集は**非破壊的**です — 既存のファイルやスクリプトは、`--force` を渡さない限り上書きされません。

### `init` が生成・編集するもの

- `test-proxy-recorder.config.ts` — プロキシの設定（自動検出されるため、その後の `npx test-proxy-recorder` はフラグ不要）。
- `playwright.config.ts` — プロキシの `/__control` エンドポイントを指す `webServer` と `globalTeardown` を追加します。既存の Playwright 設定は**その場で編集**されます。Playwright がまったく無い場合、`init` はまず Playwright CLI を実行してセットアップします（スキップするには `--no-install`）。
- `e2e/fixtures.ts` と `e2e/global-teardown.ts` — テストごとのプロキシ用フィクスチャと teardown。
- `package.json` — `proxy`、`proxy:reset`、`test:e2e`、`test:e2e:record` スクリプトを追加します。`dev` スクリプトがある場合はラップされ、元のものは `dev:app` に移り、`dev` はプロキシをアプリと並行して実行する `concurrently` コマンドになります（つまり `npm run dev` は開発中に記録します）。`concurrently` が `devDependencies` に追加されます。

すでに `webServer` を定義している Playwright 設定はそのまま残され、何を追加すべきかのメモが付きます。

## 唯一の手動ステップ

**`init` が代わりにできない唯一のステップ**は、アプリのバックエンド呼び出しをプロキシ経由にルーティングすることです — どの環境変数が API のベース URL を保持し、どのように開発環境に限定するかはアプリ固有です。`init` は完了時にこのための具体的な手順を表示します: その環境変数を `http://localhost:8100` に向けてください。**開発/テストのみで、本番では決して行わないでください**（例: `dev:app` スクリプトの先頭に付け、Windows では `cross-env` を使用）。プロキシはその後、記録しながら実際のバックエンドへ転送し、再生時には記録を提供します。

その後、テストを書き、実際の API に対して一度記録し、再生に切り替え、`e2e/recordings/` をコミットします。[手動セットアップ](/ja/docs/getting-started/manual-setup/)にそのループ全体が示されています。
