---
title: クイックスタート
description: 1 つの init コマンドで test-proxy-recorder をスキャフォールドします — Next.js SSR ミドルウェアも同梱。API をプロキシに向け、一度記録し、CI で再生するだけです。
---

## 1. スキャフォールド

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

以下のファイルをすべて書き出しますが、既存ファイルは上書きしません:

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # Next.js のみ — SSR ミドルウェア
e2e/fixtures.ts          # record と replay の切り替え
e2e/global-teardown.ts
package.json             # + proxy / test:e2e スクリプト
```

## 2. アプリの API をプロキシに向ける

`init` が推測できない唯一のものは、API のベース URL を保持している環境変数です。レコーダーが有効な場合はプロキシを指し、それ以外の場合は実際のバックエンドを指すようにします — プロキシは本番では決して動きません:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init` が示したプロキシのアドレス
```

## 3. 一度記録し、永遠に再生する

```bash
# fixtures.ts: MODE = 'record' — 実際のレスポンスをキャプチャ
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — その後、記録をコミット
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

これで CI はバックエンドを落とした状態で再生します — 毎回同じレスポンスが得られます。

---

手動で組み立てる場合や、詳細が知りたい場合は、[手動セットアップ](/ja/docs/getting-started/manual-setup/)と[仕組み](/ja/docs/getting-started/how-it-works/)を参照してください。
