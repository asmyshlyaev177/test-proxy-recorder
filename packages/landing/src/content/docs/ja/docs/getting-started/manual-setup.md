---
title: 手動セットアップ
description: フルスタック（SSR + ブラウザ）アプリ、またはブラウザのみの SPA / 拡張に test-proxy-recorder を手で組み込み、一度記録して CI で再生します。
---

ほとんどの人は [`init`](/ja/docs/getting-started/quick-start/) を実行すべきです — 以下のファイルをすべて書き出してくれます。このページは `init` が生成する内容のリファレンスで、手で組み込んだり、コード生成を省いたり、各ピースを理解したりするために使います。

## フルスタック（SSR + ブラウザ）

Next.js や類似フレームワーク向けで、サーバーとブラウザの両方が API 呼び出しを行う場合。両方の記録メカニズムを併用します — [仕組み](/ja/docs/getting-started/how-it-works/)を参照。

プロキシは**テスト実行のためにアプリと並べて起動する**（以下のスクリプトや Playwright の `webServer` で）軽量なプロセスであり、デプロイや保守するインフラではありません。セットアップ全体は、アプリの隣で起動し、アプリの API ベース URL をそこに向け、SSR からセッションヘッダーを伝播し、フィクスチャを 1 つ書くだけです。

### 1. `package.json` にスクリプトを追加する

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

アプリのコードでは、recorder が有効な場合はプロキシへ、そうでない場合は実際のバックエンドへ API のベース URL を向けてください — プロキシは本番では実行されません：

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // proxy address
```

`TEST_PROXY_RECORDER_ENABLED` は上記の `dev:proxy` / `serve:proxy` スクリプト、および `init` が生成したスクリプトによって設定されます。アプリが API のベース URL に既に使用している環境変数を使ってください（例えば `API_URL`、`NEXT_PUBLIC_API_URL`） — 同じ条件分岐が適用されます。

:::note[Next.js]
テストの記録・再生には `dev` より `build` + `serve` を推奨します。Next.js の開発サーバーは遅く、タイムアウトや不安定な記録を引き起こすことがあります。
:::

### 2. サーバーサイドフェッチにタグ付けする（Next.js）

サーバーサイドの `fetch` 呼び出しには記録セッションヘッダーが必要で、これによりプロキシはそのリクエストがどのテストに属するかを知ります。Playwright がすでにブラウザのナビゲーションにそれを設定しているため、id は `next/headers` にあります — あとは送信する SSR リクエストにそれを付与するだけです。ルートレイアウトに 1 行追加してください（`init` がこれを行います）:

```typescript
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

これは Node と Edge の両方のランタイムで動作します。axios アプリの場合は、代わりに各サーバーサイドインスタンスで `registerProxyAxios(instance)` を呼んでください。単一の fetch には `createHeadersWithRecordingId(await headers())` がパッチ不要の代替です。`setNextProxyHeaders` を使う `proxy.ts`/`middleware.ts` は**任意**です — id を公開するだけで、フェッチにはタグ付けしません。**本番ビルド**（`next build && next start`）に対して記録し、`next dev` では行わないでください。詳しくは [Next.js インテグレーション](/ja/docs/integrations/nextjs/)を参照。ブラウザのみのアプリはこのステップを省略できます。

### 3. テストを書く

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR requests (server → proxy) are recorded to .mock.json.
// Browser requests to the proxy URL are also covered.
const CLIENT_SIDE_URL = /localhost:8100/;

// Change to 'record' to update recordings.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. 記録する

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 5. 再生に切り替えてコミットする

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## ブラウザのみ / SPA / 拡張

すべての API 呼び出しがブラウザから来る場合（SSR なし）、必要なのは HAR メカニズムだけです。記録そのものにプロキシのバックエンドは不要です — プロキシのプロセスはセッション管理を提供するだけです。

### 1. インストール

```bash
npm install --save-dev test-proxy-recorder
```

### 2. `playwright.config.ts` にプロキシを追加する

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

ブラウザのみの記録では、プロキシのターゲット（`https://api.example.com`）は重要ではありません — サーバーサイド（SSR）リクエストもプロキシ経由にする必要がある場合にのみ使われます。プロキシのプロセスは、セッション管理のために `/__control` エンドポイントが利用可能になるよう実行されている必要があります。

### 3. フィクスチャを書く

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Match the external API domain your browser makes requests to.
// In record mode these requests go to the real API and are saved.
// In replay mode they are served from disk — no network needed.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. テストを書く

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. 記録する — 実際の API に対して一度実行する

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. 再生に切り替えてコミットする

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

CI はネットワークアクセスなしで実行できるようになります。

:::caution
`e2e/recordings` を `.gitignore` に追加**しないでください**。CI での再生のため、記録は git に入っている必要があります。
:::

PR の差分で大きな記録ファイルを折りたたむには、`.gitattributes` に次を追加してください:

```text
/e2e/recordings/** binary
```
