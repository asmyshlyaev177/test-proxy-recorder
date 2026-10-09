---
title: クイックスタート
description: 1 つの init コマンドで test-proxy-recorder をセットアップします — AI エージェントで進めるのがベスト。アプリの API をプロキシに向け、一度記録し、CI で再生します。
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 2069e312fd2960771c4b3d1a68714cae12c23410
---

## AI エージェントでセットアップする（推奨）

以下をコピーして、AI コーディングエージェント（Claude Code、Cursor など）に貼り付けてください:

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

エージェントはスキルを追加し、`init` で（設定、Playwright フィクスチャ、ティアダウン、スクリプト、そして Next.js の場合はルートレイアウトの `registerProxyFetch()`）すべてをスキャフォールドし、それから `init` がプロンプトから推測できない配線を `init` が表示する指示に従って完了させます。完成したセットアップをコピーして見たいですか? [examples](/ja/docs/reference/examples/) を参照してください。

## または手で組み立てる

`init` はすべてを書き出し、何も上書きしません:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # Next.js only — adds registerProxyFetch() to tag SSR fetches
e2e/fixtures.ts          # record vs replay
e2e/global-teardown.ts
package.json             # + proxy / test:e2e scripts
```

### 1. アプリの API をプロキシに向ける

`init` が推測できない唯一のものは、API のベース URL を保持している環境変数です。レコーダーが有効な場合はプロキシを指し、それ以外の場合は実際のバックエンドを指すようにします — プロキシは本番では決して動きません:

```ts
// TEST_PROXY_RECORDER_ENABLED is 'true' or '1' for the e2e run only.
const recorderEnv = process.env.TEST_PROXY_RECORDER_ENABLED ?? '';
const API_BASE = ['true', '1'].includes(recorderEnv)
  ? 'http://localhost:8100' // proxy address from `init`
  : 'https://api.example.com';
```

### 2. サーバーサイドフェッチにタグ付けする（Next.js のみ）

ブラウザのリクエストはすでに記録セッションの id を運んでいます（Playwright が設定します）。サーバーサイドフェッチ（SSR、Server Components）でも同じくタグ付けされるよう、ルートレイアウトに 1 行追加します — `init` がこれを行います:

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

サーバーサイドの呼び出しに axios を使っていますか? 代わりに `registerProxyAxios(instance)` を使ってください。本番ビルド（`next build && next start`）に対して記録し、`next dev` では行わないでください。ブラウザのみのアプリ（SPA、拡張）はこのステップを省略できます。

### 3. 一度記録し、永遠に再生する

テストは開発用バックエンドとそのデータベースを使います。`init` がアプリの本番ビルド（`preview` スクリプト、または Next.js の `start`）を見つけた場合、`test:e2e` スクリプトはその本番ビルドをテストします。一方、素の `npx playwright test` や `--ui` は開発サーバーを使うため、失敗したテストを手動で再実行し、ブラウザでバグを再現できます。記録する前に `dev` を起動し、自前のシードスクリプトで開発データベースをテストが想定する状態にしてください。

```bash
# Sets RECORD_MODE=1 — capture real responses
npm run test:e2e:record

# Then commit the recordings; npm run test:e2e replays them
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

これで CI はバックエンドを落とした状態で再生します — 毎回同じレスポンスが得られます。

---

より詳しく: [手動セットアップ](/ja/docs/getting-started/manual-setup/) · [仕組み](/ja/docs/getting-started/how-it-works/) · [AI エージェントスキル](/ja/docs/reference/ai-agent-skills/)。
