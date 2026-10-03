---
title: 'test-proxy-recorder と MSW、routeFromHAR、Polly.js、Next.js テストモードの比較'
description: 'test-proxy-recorder を MSW、routeFromHAR、Polly.js、Next.js テストモード、mockttp、Mocky Balboa、scenarist、talkback、proxay と、出典付きで比較します。'
sidebar:
  label: 比較
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

ここで取り上げるツールはいずれも、エンドツーエンドテストが受け取る API レスポンスを制御します。違いは、リクエストをどこでインターセプトするか（ブラウザ内、サーバー内、または別のプロキシ）と、レスポンスを自分で書くか記録するかです。表は[ドキュメントの概要](/ja/docs/#comparison)にある 6 つのツールをそのまま残し、Next.js テストモード、mockttp、scenarist、talkback、proxay を加えています。各セルの内容は、表の下にリンクしたそれぞれのツールのドキュメント、README、ソースに基づく 2026-10-03 時点のものです。「記載なし」は、それらの情報源に記述がないことを意味します。

## 機能比較表 {#table}

| ツール | 実際のトラフィックを記録 | サーバーサイド (SSR) | ブラウザサイド | WebSocket | Playwright ネイティブ | 最新リリース |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | 対応 | 対応（プロキシ経由） | 対応（HAR 経由） | 対応 | 対応 | 1.3.1（2026-08-05） |
| Playwright `routeFromHAR` | 対応 | 非対応 | 対応 | 非対応 | 組み込み | Playwright 1.63.0（2026-09-04） |
| MSW | 非対応（ハンドラー、または `@msw/source` 経由の HAR） | サーバーのプロセス内 | 対応 | 対応 | `@msw/playwright`（ブラウザのリクエスト） | 3.0.2（2026-10-03） |
| Polly.js | 対応 | サーバーのプロセス内 | 対応 | 記載なし | サードパーティのアダプター | `@pollyjs/core` 6.0.6（2023-07-20） |
| playwright-network-cache | 対応 | 非対応 | 対応 | 記載なし | 対応 | 0.3.0（2026-05-12） |
| Mocky Balboa | 非対応（ハンドラー） | 対応 | 対応 | 記載なし | 対応 | `@mocky-balboa/playwright` 2.0.2（2026-05-21） |
| Next.js テストモード | 非対応（ハンドラー） | 対応（Next.js のみ） | 他のオリジンへのリクエスト | 記載なし | 対応 | 実験的機能、Next.js 16.3.8 に同梱（2026-09-30） |
| mockttp | 記載なし | 対応（フォワードプロキシとして） | 対応（ブラウザのプロキシとして） | 対応 | 非対応（フィクスチャを自分で書く） | 4.6.3（2026-09-11） |
| scenarist | 非対応（シナリオをコードで書く） | Next.js と Express | 非対応 | 記載なし | 対応 | 0.5.1（2026-09-27） |
| talkback | 対応 | 対応（API のアドレスとして） | 記載なし | 記載なし | 非対応 | 4.2.0（2024-07-10） |
| proxay | 対応 | 対応（API のアドレスとして） | 対応（API のアドレスとして） | 記載なし | 非対応 | npm 1.9.0（2024-05-15）、GitHub 2.0.0（2026-01-29） |

## 出典と注記 {#sources}

リリース日は、GitHub のリリースへのリンクがない限り npm レジストリのものです。

- **test-proxy-recorder:** サーバーサイドの呼び出しはプロキシを、ブラウザからの呼び出しは HAR を通ります（[仕組み](/ja/docs/getting-started/how-it-works/)）。記録された WebSocket メッセージはプロキシが再生します（[CLI](/ja/docs/guides/cli/#websocket-replay-pacing)）。リリース: [npm](https://www.npmjs.com/package/test-proxy-recorder)。
- **Playwright `routeFromHAR`:** `update: true` を指定すると、実際のトラフィックから HAR を記録します（[Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)）。再生が対象とするのは「ページ内で行われるネットワークリクエスト」です（[API](https://playwright.dev/docs/api/class-page#page-route-from-har)）。HTTP リクエストに応答する `route()` ハンドラーを経由し、WebSocket を扱う経路はありません（[`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)）。リリース: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0)。
- **MSW:** リクエストハンドラーは自分で書きます。MSW 自体は何も記録しませんが、[`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) を使えば、ブラウザの DevTools からエクスポートした HAR ファイルからハンドラーを生成できます。Node.js では、リクエストを行うプロセスの中で動作します（[`setupServer`](https://mswjs.io/guides/integrations/node)）。WebSocket には [`ws` API](https://mswjs.io/docs/websocket) を使います。公式の [`@msw/playwright`](https://github.com/mswjs/playwright) バインディングは `page.route()` を経由するため、対象はブラウザのリクエストです。リリース: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2)。
- **Polly.js:** [リポジトリ](https://github.com/Netflix/pollyjs)では「HTTP のやり取りを記録、再生、スタブする」ライブラリと説明されています。[node-http アダプター](https://netflix.github.io/pollyjs/#/adapters/node-http)は Node の `http` と `https` モジュールにパッチを当て、[fetch アダプター](https://netflix.github.io/pollyjs/#/adapters/fetch)はグローバルな `fetch` をラップします。そのため Polly は、自身を実行しているプロセスの中で記録します。ドキュメントに WebSocket アダプターは載っていません。Playwright への対応はサードパーティの [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright) によるもので、[Polly のドキュメント](https://netflix.github.io/pollyjs/#/adapters/playwright)からリンクされています。リリース: [npm](https://www.npmjs.com/package/@pollyjs/core)。
- **playwright-network-cache:** [README](https://github.com/vitalets/playwright-network-cache) によると、「ネットワークリクエストをファイルシステムにキャッシュすることで」Playwright テストを高速化します。`CacheRoute` は `page.route()` でインターセプトするため（[ソース](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)）、対象はブラウザのリクエストだけです。リリース: [npm](https://www.npmjs.com/package/playwright-network-cache)。
- **Mocky Balboa:** モックはテストの中で定義し、サーバーとクライアントのリクエストを 1 つの API で扱います。テストを並列に実行しても、モックはテストごとに分離されます（[機能](https://docs.mockybalboa.com/docs/features/)）。Next.js 14 以降では、CLI が Next.js サーバーを起動します（[Next.js](https://docs.mockybalboa.com/docs/server/next-js/)）。ドキュメントで WebSocket に触れているのは、サーバーとテストランナーの間の通信経路としてだけです。リリース: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright)。
- **Next.js テストモード:** `next.onFetch()` で登録したハンドラーは、サーバーの `fetch` 呼び出しに加えて、ページが他のオリジンに対して行う `fetch` 呼び出しも受け取ります（[README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md)、[`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)）。セットアップ、現状、MSW 3 については[サーバーサイドのモック](/ja/docs/guides/server-side-mocking/#nextjs-test-mode)で説明しています。リリース: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8)。
- **mockttp:** 「Node またはブラウザで」動くテスト向けの、HTTP と HTTPS のモックサーバー兼プロキシです（[README](https://github.com/httptoolkit/mockttp)）。`forAnyWebSocket()` で WebSocket 接続をモックします（[ソース](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)）。README に記録モードの記述はありません。書くべきフィクスチャは Playwright チームの[記事](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)に示されています。リリース: [npm](https://www.npmjs.com/package/mockttp)。
- **scenarist:** [README](https://github.com/citypaul/scenarist) によると「MSW の上に構築され、実行時のシナリオ管理とテスト ID による分離を備えた」ツールで、シナリオはコードで書きます。FAQ では「サーバーサイドのシナリオ管理を提供し、Playwright のクライアントサイドのモックを補完する」と説明されています。サーバーのコードは各 `fetch` で `x-scenarist-test-id` を転送し（[Next.js アダプター](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)）、`@scenarist/playwright-helpers` が Playwright のフィクスチャを提供します。リリース: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter)。
- **talkback:** 「HTTP リクエストを記録・再生する JavaScript の HTTP プロキシ」です（[README](https://github.com/ijpiantanida/talkback)）。アプリはリクエストを talkback に送ります。保存済みのテープに一致するリクエストにはそのテープのレスポンスが返され、未知のリクエストはホストに転送されて新しいテープとして保存されます。README には、ブラウザについてもテストごとのテープについても記述がありません。リリース: [npm](https://www.npmjs.com/package/talkback)。
- **proxay:** 「Web フロントエンドとそのバックエンド」や「サーバーと別のサーバー」の間で使う、記録・再生用のプロキシです（[README](https://github.com/airtasker/proxay)）。テストは `beforeEach` などで `POST /__proxay/tape` を使ってテープを選びます。README は並列テストについて扱っていません。バージョン 2.0.0 は [GitHub のリリース](https://github.com/airtasker/proxay/releases/tag/v2.0.0)で、[npm](https://www.npmjs.com/package/proxay) では今も 1.9.0 が配布されています。

## Playwright 向けの Polly.js の代替 {#pollyjs}

Netflix の Polly.js は HTTP を記録・再生・スタブするライブラリで、test-proxy-recorder の着想元です。2026-10-03 時点の状況は次のとおりです:

- `@pollyjs/core` は 2023-07-20 の 6.0.6 以降リリースがありません。リポジトリの最後の変更は 2025-05-31 で、`@pollyjs/adapter-fetch` 6.0.7 を公開し、Node 向けの fetch アダプターの非推奨を解除しました（[Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)）。
- Polly には独自の Playwright アダプターがありません。ドキュメントはサードパーティの [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright) を案内しており、これはブラウザコンテキストまたはページにアタッチします。その最新リリースは 2024-04-18 の 2.4.0 です。
- サーバーサイドの呼び出しに使うには、Polly を node-http または fetch アダプター経由でサーバーのプロセス内で動かす必要があります。

Polly.js から移行する場合、その概念は test-proxy-recorder では次のように対応します。

| Polly.js | test-proxy-recorder |
| --- | --- |
| `record`、`replay`、`passthrough` の各モード（[設定](https://netflix.github.io/pollyjs/#/configuration)） | `record`、`replay`、`transparent` の各モード。`playwrightProxy.before()` でテストごとに設定 |
| Polly インスタンスごとの名前付きの記録。パーシスター（persister）が保存 | Playwright のテストごとに `.mock.json`（サーバー）と `.har`（ブラウザ）を 1 つずつ。記録ディレクトリに保存 |
| リクエストを行うプロセス内のアダプター | サーバーの呼び出しにはプロキシのプロセス、ブラウザの呼び出しには HAR、そしてサーバー上の `registerProxyFetch()` |
| デフォルトではメソッド、ヘッダー、ボディ、順序、URL でリクエストを照合 | サーバーサイドのリクエストはメソッド、パス、クエリのハッシュで照合し、記録された順に返し、ボディは比較しない。ブラウザのリクエストは Playwright の HAR のルールに従い、こちらは POST のボディも比較する |

## Next.js と Playwright での MSW {#msw}

Next.js アプリでは、ブラウザのリクエストとサーバーのリクエストで MSW のセットアップが異なります。

- **ブラウザのリクエスト:** 公式バインディングの [`@msw/playwright`](https://github.com/mswjs/playwright) は、ハンドラーを `page.route()` 経由で実行します。テストごとに変更できる `network` フィクスチャがあります。
- **サーバーのリクエスト:** MSW は Next.js のプロセス内で動作します。MSW のドキュメントには Next.js のガイドがなく、参考となる例はオープンなままのプルリクエスト [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) です。実行時に変更したハンドラーは、そのサーバーにアクセスするすべてのテストで共有されます。詳細と出典は[サーバーサイドのモック](/ja/docs/guides/server-side-mocking/#msw)にあります。
- **テストごとのサーバーハンドラー:** Next.js テストモードはテストごとに MSW のハンドラーを受け付けますが、その MSW 用エントリーポイントは MSW 3.0 では読み込みに失敗します（[詳細](/ja/docs/guides/server-side-mocking/#nextjs-test-mode)）。scenarist は Next.js と Express 向けに MSW の上でテストごとのシナリオを構築し、サーバーのコードが各 `fetch` でテスト id のヘッダーを転送します。
- **記録:** MSW はトラフィックを記録しません。[`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) は、ブラウザの DevTools からエクスポートした HAR ファイルをハンドラーに変換します。

test-proxy-recorder はその逆のトレードオフを選んでいます。両方の側を実際の API から記録するため、書くべきハンドラーはありません。その代わり、API が思いどおりに返してくれないレスポンスは制御しにくくなります。

## 他のツールを使うべき場合 {#when-to-use-something-else}

- **トラフィックがすべてブラウザサイドの場合:** Playwright 組み込みの `routeFromHAR` なら追加の依存は不要です。まずそこから始め、サーバーサイドのリクエストが出てきたら test-proxy-recorder を追加してください。
- **レスポンスを手で書きたい、またはエラーやエッジケースを強制したい場合:** MSW のハンドラーの方が適しており、MSW は Playwright だけでなく [Vitest](https://mswjs.io/guides/integrations/vitest)、[Storybook](https://mswjs.io/guides/integrations/storybook)、[ブラウザ](https://mswjs.io/guides/integrations/browser)でも動作します。Playwright でテストごとのサーバーサイドのハンドラーが必要なら、Mocky Balboa、scenarist、Next.js テストモードを検討してください。
- **少ないセットアップでブラウザサイドのキャッシュだけが必要な場合:** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) は 1 つのフィクスチャでレスポンスをディスクにキャッシュします。
- **サーバーが JavaScript で書かれていない、またはそのコードを変更できない場合:** mockttp のようなフォワードプロキシは `HTTPS_PROXY` を通じて動作します。Playwright チームの[記事](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)によると、Python、Go、Ruby、Rust、.NET も同じ方法で動作し、Java では `-Dhttps.proxyHost` と `-Dhttps.proxyPort` が必要です。
- **Playwright の外で、言語を問わず記録と再生が必要な場合:** proxay と talkback は、記録をテープファイルとして保存する単体の HTTP サーバーです。
