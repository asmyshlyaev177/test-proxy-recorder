---
title: 'Playwright でサーバーサイドのリクエストをモックする（Next.js、TanStack Start）'
description: 'Next.js と TanStack Start で page.route() がサーバーサイドフェッチを捉えられない理由と、テストモード、MSW、mockttp、記録したレスポンスで Playwright からそれらを扱う方法。'
sidebar:
  label: サーバーサイドのモック
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: f5b4c780da98c479c1bc9c0491d2ae9747da5b85
---

Next.js や TanStack Start のアプリでは、サーバーがページをレンダリングする間に API を呼び出します。Playwright のリクエストのモック機能には、そうした呼び出しはまったく見えません。以下ではその理由を説明し、Playwright テストでそれらを制御する 4 つの方法を比較します。Next.js テストモード、サーバー内の MSW、mockttp のようなフォワードプロキシ、そして test-proxy-recorder による実際のレスポンスの記録です。他のツールに関する事実は、2026-10-03 にそれぞれのドキュメントとソースで確認したものです。

## `page.route()` がサーバーサイドのリクエストを捉えられない理由 {#why}

Playwright の [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) が対象とするのは「ページが行うネットワークリクエスト」です。一方、Server Component、ルートの loader、server function はアプリの Node.js プロセスの中で実行されます。その `fetch` は、そのプロセスから API へ直接送られます。リクエストはブラウザを一切通らないため、Playwright にはインターセプトするものがありません。`page.route()` は、ブラウザがアプリに送るページのリクエストと、返ってくる HTML は捉えます。しかし、その HTML を作るためにサーバーが行ったリクエストは捉えません。

HAR ファイルにも同じ制限があります。[`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) が応答するのは「ページ内で行われるネットワークリクエスト」だからです。

MSW の [Playwright との比較](https://mswjs.io/docs/comparison#playwright)も同じことを述べています。`page.route()` が影響するのは「起動されたブラウザ内のトラフィックであり、Node.js プロセスではない」というものです。Playwright チームの[サーバーサイドのモックに関する記事](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)は、`page.route()` はブラウザのリクエストには使えると述べたうえで、「サーバーサイドの HTTP 呼び出しには使えない」としています。組み込みのサーバーサイドモックを求める機能リクエスト [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766) は、2026-05-22 にその記事へのリンクを添えてクローズされました。

## Next.js テストモード {#nextjs-test-mode}

Next.js には、`next/experimental/testmode/playwright` に実験的な Playwright インテグレーションが含まれています。ドキュメントは [Next.js リポジトリ内の README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md) だけで、[Next.js の Playwright ガイド](https://nextjs.org/docs/app/guides/testing/playwright)には記載がありません。テストが `next.onFetch()` でハンドラーを登録すると、Next.js はサーバーの `fetch` 呼び出しをそのハンドラーに送ります:

```typescript
// README から抜粋して短縮したもの
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

必要なもの:

- `next.config.js` の `experimental: { testProxy: true }`。
- `next/experimental/testmode/playwright` の `defineConfig` で作った `playwright.config.ts` と、同じモジュールから `test` をインポートするテスト。

内部では、各 Playwright ワーカーが小さなプロキシサーバーを起動します。フィクスチャはページのリクエストに `Next-Test-Proxy-Port` ヘッダー（そのプロキシ）と `Next-Test-Data` ヘッダー（テスト id）を追加します（[`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)）。`testProxy` が有効だと、サーバーはそれらのヘッダーを読み取り、サーバーサイドの各 `fetch` をそのプロキシに送ります。プロキシはリクエストをそのテストのハンドラーに渡します（[`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)）。ハンドラーはテスト id ごとに保持されるため、並列のテストが 1 つの Next.js サーバーを共有できます。どのハンドラーも応答しないサーバーの fetch は `Proxy request aborted` をスローします。代わりに、ハンドラーが `'continue'` を返してリクエストを通すこともできます。`next.onFetch()` は、ページ自身が他のオリジンに対して行う `fetch` 呼び出しも受け取ります。

現状:

- 実験的な機能です。インポートパスと設定キーの両方がそう示しており、README のタイトルも「Experimental test mode for Playwright」です。
- 修正は今も続いています。最新の修正 [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525) は 2026-08-13 にマージされました。
- README では、`next/experimental/testmode/playwright/msw` を通じてテストごとの MSW ハンドラーも提供しています。MSW 3.0（2026-09-28 リリース）では、このエントリーポイントの読み込みに失敗します。MSW 3.0 がもう依存していない `strict-event-emitter` をインポートしているためです。また、3.0 で削除された MSW の `handleRequest()` も呼び出しています（[MSW 3.0 のリリースノート](https://github.com/mswjs/msw/releases/tag/v3.0.0)、[`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)）。MSW 2.15.0 では読み込めます。どちらの結果も Next.js 16.3.8 で、2026-10-03 に確認したものです。

## Next.js サーバー内の MSW {#msw}

MSW は Node.js では `msw/node` の `setupServer` でリクエストをインターセプトします（[Node.js インテグレーション](https://mswjs.io/guides/integrations/node)）。MSW のドキュメントには Next.js のガイドがありません。MSW の作者は App Router に関する issue をクローズした際、インテグレーションの参考として [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) を挙げました（[コメント](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)）。このプルリクエストは 2024-01-22 からオープンのままです。この例では、固定のハンドラー一覧を使い、ルートレイアウトからインターセプターを起動します:

```tsx
// app/layout.tsx（mswjs/examples#101 より）
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

ハンドラーは Next.js のプロセス内に置かれます。この例ではそのプロセスを Playwright の `webServer` で起動しますが、`webServer` は実行全体で 1 つのプロセスを動かします（[Playwright チームの記事](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)）。すべてのワーカーがその 1 つのサーバーにページを送るため、ワーカーが並列に動くとハンドラーの振る舞いが変わります:

- テストは自身のワーカープロセスで実行されるため、そのサーバーに対して `server.use()` を呼べません。MSW には、別プロセスのハンドラーを変更する API がまだリリースされていません。その提案である [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617) の `setupRemoteServer` は、2023-05-12 からオープンのままです。MSW の Playwright バインディングは、それがリリースされるまでは `page.route()` に頼ると説明しています（[`@msw/playwright`](https://github.com/mswjs/playwright)）。
- `server.use()` を呼ぶ API ルートのような独自の経路を追加すると、その変更はすべてのテストに及びます。[`server.use()`](https://mswjs.io/api/setup-server/use) で追加したハンドラーは「サーバーインスタンス上に残り続けます」。[server boundary の記事](https://mswjs.io/blog/introducing-server-boundary)は、1 つのサーバーに対する同時の上書きが「すべてのテストで共有されるグローバルな状態」になると説明しています。#1617 で MSW の作者は、実際には「固定のハンドラー一覧」を保つか、「テストケースごとにアプリのインスタンス」を起動するかのどちらかになると述べています。

実際には、共有された Next.js サーバー内の MSW は、並列に動くすべてのテストに同じレスポンスを返します。MSW の上にテストごとのハンドラーを加えるツールが 2 つあります。Next.js テストモードは MSW のハンドラーを受け付けます（MSW 2 の場合。上記を参照）。[scenarist](https://github.com/citypaul/scenarist) は、サーバーのコードが各 `fetch` で転送する `x-scenarist-test-id` ヘッダーをキーにしてシナリオを対応づけます（[Next.js アダプター](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)）。

## mockttp のようなフォワードプロキシ {#mockttp}

Playwright チームは #30766 をクローズする際、Simon Knott の[記事](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)を[案内しました](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681)。この記事では、HTTP と HTTPS のモックサーバー兼プロキシである [mockttp](https://github.com/httptoolkit/mockttp) を、サーバーから外へ出るトラフィックの前段に置きます。各テストは `mocks.forPost(url).thenJson(200, body)` のようなルールを追加します。

アプリのコードは変わりません。サーバーのプロセスは、外向きのリクエストをプロキシ経由で送る環境変数を付けて起動します:

- `HTTP_PROXY` と `HTTPS_PROXY` にプロキシの URL を設定する。
- `NODE_USE_ENV_PROXY=1`。これで Node 組み込みの `fetch` がそれらの変数を使います。Node.js は 24.0.0 と 22.21.0 でこれを追加し、活発に開発中（active development）の機能としています（[Node.js のドキュメント](https://nodejs.org/api/cli.html#node_use_env_proxy1)）。
- プロキシの CA 証明書を指す `NODE_EXTRA_CA_CERTS`。これで、mockttp が HTTPS ホスト用に生成する証明書をサーバーが信頼します。

プロキシは 1 つの Playwright ワーカーに属するため、記事ではワーカーフィクスチャからワーカーごとに 1 つずつ、空いているポートでアプリサーバーを起動します。Playwright の `webServer` は、どのワーカーも存在しないうちに実行全体で 1 つのプロセスを起動するため、使いません。記事の構成では、ルールのないリクエストは実際の API へそのまま通ります。記事は、モックの書き忘れに気づけるよう、代わりにエラーで応答することを勧めています。

Playwright チームはこのアプローチを「サーバーの言語やフレームワークに依存しない」と説明しています。記事自体は、Next.js や TanStack Start ではなく素の Node サーバーを使っています。

## test-proxy-recorder で実際のレスポンスを記録する {#test-proxy-recorder}

上の 3 つの方法では、すべてのレスポンスを自分で書きます。test-proxy-recorder は、ローカルでの実行中に実際の API が返したものを記録し、CI で再生します。

- **プロキシ:** テスト実行のため、アプリと並べて `test-proxy-recorder <target-url>` を起動します。`TEST_PROXY_RECORDER_ENABLED` が設定されている間は、アプリの API ベース URL をプロキシに向けます。各プロキシは 1 つのバックエンド、つまり起動時に指定した `<target-url>` に転送します。
- **`registerProxyFetch()`:** サーバーで 1 回呼び出すと、グローバルな `fetch` にパッチを当てます。現在のリクエストの `x-test-rcrd-id` ヘッダーを、すべての外向きのリクエストにコピーします。プロキシはこのヘッダーを読み取り、サーバーサイドの各呼び出しをそれぞれのテストの記録に振り分けます。`TEST_PROXY_RECORDER_ENABLED` が設定されていない限り、本番ではこの呼び出しは何もしません（no-op）。
- **テストごとの id:** `playwrightProxy.before(page, testInfo, mode)` は、spec ファイルとテストのタイトルからセッション id を組み立てます。その id をページのリクエストに `x-test-rcrd-id` として付けて送り、そのセッションを `record` または `replay` に切り替えます。並列のワーカーは 1 つのアプリサーバーと 1 つのプロキシを共有しますが、それでも各テストは専用の記録を持ちます。

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

実際の API に対して一度記録し、`.mock.json`（サーバー）と `.har`（ブラウザ）のファイルをコミットします。その後、CI はバックエンドをオフにしたままそれらを再生します。再生時、記録のないリクエストにはそのリクエストを示す 404 が返され、API には到達しません。

記録したレスポンスがカバーするのは、記録中に API が実際に返したものだけです。API が思いどおりに返してくれないエラーやエッジケースを強制するには、上記の方法のいずれかで手書きのハンドラーを使う方が簡単です。

セットアップの詳細は [Next.js](/ja/docs/integrations/nextjs/) と [TanStack Start](/ja/docs/integrations/tanstack-start/) のガイドにあります。

## 方法の比較 {#comparison}

| 方法 | アプリ側のセットアップ | 並列テスト | ハンドラーか、記録したレスポンスか | Next.js と TanStack Start |
| --- | --- | --- | --- | --- |
| [Next.js テストモード](#nextjs-test-mode) | `next.config.js` の `experimental.testProxy` | 対応。ハンドラーはテストごとに保持される | ハンドラー（`next.onFetch()`、または MSW 2 のハンドラー） | Next.js のみ |
| [サーバー内の MSW](#msw) | サーバーのコードで起動する `setupServer`（MSW の例ではルートレイアウト） | そのサーバー上のすべてのテストでハンドラーセットは 1 つ | ハンドラー | Next.js: オープンなプルリクエスト内の例。TanStack Start: 記載なし |
| [mockttp](#mockttp) | コード変更なし。サーバーのプロセスにプロキシ用の環境変数と CA 証明書 | 対応。ワーカーごとに 1 つのアプリサーバー | ハンドラー。ルールのないリクエストはそのまま通過 | 記載なし。Playwright チームはフレームワークに依存しないとしている |
| [test-proxy-recorder](#test-proxy-recorder) | テスト中は API ベース URL をプロキシに向け、加えて `registerProxyFetch()` | 対応。共有のアプリサーバー 1 つで | 実際の API から記録 | どちらも記載あり |

[比較](/ja/docs/reference/comparison/)のページでは、Mocky Balboa、scenarist、Polly.js、talkback、proxay を含むより多くのツールと、ブラウザサイドの選択肢を扱っています。
