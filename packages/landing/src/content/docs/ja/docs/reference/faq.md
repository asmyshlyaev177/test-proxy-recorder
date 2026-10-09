---
title: FAQ
description: test-proxy-recorder に関するよくある質問 — 並列再生、記録の git へのコミット、HAR 記録のためのプロキシターゲット、Next.js の開発サーバー、記録の更新。
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
---

## 並列の再生テストが時々実際のバックエンドを呼ぶのはなぜ? {#parallel-replay}

おそらくテストごとのフックで `playwrightProxy.teardown()` を呼んでいます。これはプロキシの**グローバル**モードを `transparent` に設定し、`fullyParallel: true` では各 Playwright ワーカーが自身の `test.afterAll` を実行します。速いテストが終わって `teardown()` を呼ぶ一方で遅いテストがまだ実行中だと、プロキシはテストの途中で transparent に切り替わり、残りのリクエストは再生されずに実際のバックエンドへ転送されます。

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**対処:** `test.afterAll` を省いてください。セッションのクリーンアップは `context.on('close')` → `cleanupSession()` で自動的に行われます。実行全体の後にプロキシをリセットする必要がある場合にのみ [global teardown](https://playwright.dev/docs/test-global-setup-teardown) を使ってください。

再生中の実行が実際のバックエンドに到達するもう 1 つの経路は、セッションのタイムアウトです。タイムアウトは `playwrightProxy.before()` を呼ぶたびにリセットされますが、プロキシを通るリクエストではリセットされません。次の `before()` の呼び出しより前にタイムアウト（デフォルトは 120000 ms）が切れると、プロキシは `transparent` に切り替わります。その時点でまだ実行中のテストは、残りのリクエストを実際のバックエンドへ送ります。1 つのテストがそれほど長く実行されうる場合は、[CLI](/ja/docs/guides/cli/) の `--timeout` か[設定](/ja/docs/guides/config/)の `timeout` でタイムアウトを延ばしてください。

## 並列ワーカーで記録できますか? {#parallel-recording}

いいえ。プロキシは一度に 1 つの記録セッションしか保持しません。2 つ目のテストが記録を始めると、プロキシは 1 つ目のテストのファイルを保存して 2 つ目のテストに切り替えます。その後、1 つ目のテストがプロキシ経由で送る残りのリクエストは、2 つ目のテストの `.mock.json` に入ってしまいます。`init` が追加する `test:e2e:record` スクリプトがすでにそうしているように、記録はワーカー 1 つで行ってください:

```bash
npx playwright test --workers 1
```

再生は並列ワーカーで実行できます。各テストは自身のセッションを再生し、それらは `x-test-rcrd-id` ヘッダーで区別されます。`playwrightProxy.before()` がページのリクエストにこのヘッダーを設定し、`registerProxyFetch()` がサーバーサイドのリクエストにコピーします。[サンプルアプリ](/ja/docs/reference/examples/)が `--workers 1` で記録しているのはこのためです。

## 記録は git にコミットすべきですか?

はい。CI がネットワークなしで再生できるよう、記録は git に入っている必要があります — `e2e/recordings` を `.gitignore` に追加し**ないでください**。大きな記録ファイルが PR のレビューの妨げにならないよう、`.gitattributes` で生成ファイルとしてマークしてください。GitHub はその差分をデフォルトで折りたたみつつ、クリック 1 回で表示できるようにするため、API で名前が変わったフィールドもレビューで確認できます。`binary` としてマークすると、その変更は完全に見えなくなります。

```text
/e2e/recordings/** linguist-generated=true
```

## ブラウザのみ（HAR）の記録でプロキシの `<target-url>` は重要ですか?

いいえ。ブラウザのみの記録ではターゲットは無関係です — プロキシのプロセスは、セッション管理のために `/__control` エンドポイントが利用可能になるよう実行されている必要があるだけです。ターゲットが重要なのは、サーバーサイド（SSR）リクエストもプロキシ経由でルーティングする場合だけです。

## `url` パターンに一致しないブラウザのリクエストはどうなりますか? {#outside-url}

Playwright はそれらをインターセプトしないため、記録時も再生時も実際のネットワークに送られます。それらについては何も保存されません。プロキシ（`localhost:8100`）へのリクエストは例外です。`playwrightProxy.before()` はそれらを常にプロキシへ転送し、プロキシ自身が記録・再生します。

テストをネットワークから切り離すには、HAR がそのドメインも対象にするよう `url` を広げるか、`page.route()` と `route.abort()` でそのドメインをブロックしてください:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // The HAR also records and replays the CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Analytics calls fail instead of reaching the network.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

詳しくは[再生時のリクエストの照合](/ja/docs/getting-started/how-it-works/#replay-matching)を参照してください。

## Next.js の開発サーバーに対して記録できますか?

記録・再生には `next dev` より `next build` + `next start` を推奨します。開発サーバーは遅く、タイムアウトや不安定な記録を引き起こすことがあります。

## 記録はどう更新しますか?

record モードで再実行し（`RECORD_MODE=1`、つまり `test:e2e:record` スクリプト）実際の API に対して記録してから、`e2e/recordings/` の更新されたファイルをコミットしてください。

## 再生するテストでエラー、空のリスト、遅いレスポンスを強制できますか? {#override-responses}

ブラウザのリクエストについては可能です。Playwright はルートハンドラーを[登録とは逆の順序で](https://playwright.dev/docs/api/class-route#route-fallback)実行するため、`playwrightProxy.before()` の後に追加した `page.route()` が各リクエストを最初に受け取ります。そのハンドラーは自分でリクエストに応答することも、`route.fallback()` を呼んで記録に引き渡すこともできます。

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Added after before(), so Playwright runs this handler first.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // every other request is replayed as recorded
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

空のリストにするには、代わりに `json: []` で応答します。遅いレスポンスにするには、`route.fallback()` を呼ぶ前に待機します。たとえば `await new Promise((resolve) => setTimeout(resolve, 3000))` で待つと、記録されたレスポンスが 3 秒遅れて届きます。

サーバーサイドのリクエストはブラウザを通らないため、`page.route()` では変更できません。その場合は `.mock.json` の記録を手で編集するか、必要な状態にある API に対して記録してください。ファイル内では、各記録の `response` が `statusCode`、`headers`、`body` を持っています。ボディの長さを変えた場合は、`content-length` ヘッダーも削除してください。

## デプロイ済みの環境をテストするスイートでも使えますか? {#deployed-environment}

ブラウザのリクエストについては使えます。Playwright はブラウザ内でそれらをインターセプトするため、デプロイ済みのアプリを変更せずに HAR で記録・再生できます。`url` はブラウザが呼び出す API のドメインに向けてください。ただし、`playwrightProxy.before()` はプロキシの `/__control` エンドポイント経由で各テストのモードを設定するため、プロキシはテストと並べて実行しておく必要があります。

サーバーサイドのリクエストはアプリのサーバーが行うため、デプロイ済みのサーバーが行うリクエストを CI 上のプロキシが目にすることはありません。それらを記録・再生するには、CI でプロキシと並べてアプリのサーバーを実行してください。テスト実行用にビルドして起動し、API のベース URL をプロキシに向け、`TEST_PROXY_RECORDER_ENABLED=true` を設定します。この構成は [Next.js](/ja/docs/integrations/nextjs/) と [TanStack Start](/ja/docs/integrations/tanstack-start/) のページで説明しています。
