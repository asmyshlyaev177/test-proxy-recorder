---
title: AI エージェントスキル
description: test-proxy-recorder のスキルをインストールすると、AI コーディングエージェント（Claude Code、Cursor、Copilot）が正しいセットアップコードを生成します。
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

AI コーディングエージェント（Claude Code、Cursor、Copilot など）を使っているなら、スキル読み込みを設定して、エージェントが正しいセットアップコードを生成できるようにしてください。スキルは [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) を通じて `test-proxy-recorder` パッケージに同梱され、通常のパッケージマネージャーの更新とともに配布されます。

**1. ライブラリをインストールする**（スキルはインストール済みパッケージから検出されます）:

```bash
npm install --save-dev test-proxy-recorder
```

**2. エージェント向けガイダンスを書き込む** — `install` はエージェント設定（`CLAUDE.md`、`.cursorrules` など）に検出の指示を追加し、エージェントが一致するパッケージのスキルをオンデマンドで読み込むようにします:

```bash
npx @tanstack/intent@latest install
```

汎用の検出ガイダンスではなく、明示的なタスク対スキルの対応をエージェント設定に書き込みたい場合は、`--map` を渡してください。

これでエージェントは、ガイダンスなしで、正しいプロキシ/フィクスチャのセットアップ、記録と再生のワークフロー、Next.js の SSR ヘッダーパターンを把握できるようになります。

## スキル

`test-proxy-recorder` は次のスキルを同梱しています:

- **`proxy-setup`** — プロキシ CLI、`package.json` のスクリプト、`playwright.config.ts` の `webServer`、テストごとのフィクスチャ、record/replay/transparent モード、シークレットのマスキング、そして「一度記録 → コミット → CI 再生」のライフサイクル。
- **`nextjs-ssr`** — `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId` によるサーバーサイドフェッチのタグ付け、「ビルド & 起動」対 `next dev` の注意点、ミドルウェアが任意である理由。
- **`tanstack-start`** — TanStack Start のローダー、サーバー関数、サーバールートのタグ付け、「ビルド」対 `vite dev` の注意点、サーバー対ブラウザの API URL 分割、TanStack Query の SSR プリフェッチ、実認証パターン。

インストール済みパッケージから利用可能なものを一覧表示するか、直接 1 つ読み込みます:

```bash
npx @tanstack/intent@latest list                          # 検出可能なスキルを表示
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## スキルの保守（コントリビューター向け）

エージェントスキルは [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills) にあります。定期的に — そしてライブラリの API やサンプルが変更されたときは必ず — 確認してください:

```bash
npx @tanstack/intent@latest validate   # 構造/形式/行数制限のチェック（スキル編集のコミット前に実行）
npx @tanstack/intent@latest stale      # 公開済みライブラリとのバージョン乖離を通知 — 一覧されたスキルを再確認
```

`validate` は必ずパスしなければなりません。`stale` は助言的なものです — リリース後に乖離を報告したら、該当スキルの内容を再確認してください（そして `library_version` を上げてください）。
