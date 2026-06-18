---
title: 手動セットアップ
description: フルスタック（SSR + ブラウザ）アプリ、またはブラウザのみの SPA / 拡張に test-proxy-recorder を手で組み込み、一度記録して CI で再生します。
---

1 つのコマンドの方が良いですか? [クイックスタート](/ja/docs/getting-started/quick-start/)をご覧ください。以下のセットアップは、記録 → 再生のループ全体を手作業で示します。

## フルスタック（SSR + ブラウザ）

Next.js や類似フレームワーク向けで、サーバーとブラウザの両方が API 呼び出しを行う場合。両方の記録メカニズムを併用します — [仕組み](/ja/docs/getting-started/how-it-works/)を参照。

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
    : 'http://localhost:8100'; // プロキシのアドレス
```

`TEST_PROXY_RECORDER_ENABLED` は上記の `dev:proxy` / `serve:proxy` スクリプト、および `init` が生成したスクリプトによって設定されます。アプリが API のベース URL に既に使用している環境変数を使ってください — 同じ条件分岐が適用されます。

:::note[Next.js]
テストの記録・再生には `dev` より `build` + `serve` を推奨します。Next.js の開発サーバーは遅く、タイムアウトや不安定な記録を引き起こすことがあります。
:::

### 2. テストを書く

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

### 3. 記録する

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. 再生に切り替えてコミットする

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
