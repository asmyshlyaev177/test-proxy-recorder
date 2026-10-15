---
title: '記録と再生の仕組み: SSR にはプロキシ、ブラウザには HAR'
description: test-proxy-recorder は、サーバーサイドのリクエスト用のプロキシと、ブラウザサイドのリクエスト用の HAR という 2 つのメカニズムでトラフィックを記録します。併用も単独使用も可能です。
sidebar:
  label: 仕組み
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 26b907ff9c82df698a55827441e0b4b432a42262
---

test-proxy-recorder は、リクエストの発生場所に応じて 2 つの記録メカニズムをサポートします。両方を併用することも、独立して使うこともできます。

| メカニズム | 記録する対象 | ユースケース |
| --------- | --------------- | -------- |
| **プロキシ** (`.mock.json`) | サーバーサイドのリクエスト（Next.js などの SSR フェッチ） | サーバーが API を呼ぶフルスタックアプリ |
| **HAR** (`.har`) | ブラウザサイドのリクエスト（ブラウザの `fetch`、拡張、SPA） | SPA、Chrome 拡張、サードパーティ API |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

各テストは開始時にモードを設定し、プロキシは受け取るすべてのリクエストに対して 1 つのモードを保持するため、同時に実行されるテストはそのモードを共有します。**record** モードではプロキシは実際のバックエンドへ転送してレスポンスを保存し、**replay** モードでは保存済みのレスポンスをディスクから提供し（各テストの id によってそのテストの記録が選ばれます）、**transparent** モードでは記録せずに転送します。プロキシは transparent モードで起動するため、テスト以外でプロキシ経由で実行したアプリは通常どおりバックエンドと通信します。モードの切り替え方法は[コントロールエンドポイント](/ja/docs/guides/control-endpoint/)を参照してください。

## 再生時のリクエストの照合 {#replay-matching}

プロキシと HAR ファイルでは、記録済みのレスポンスを探す方法が異なります。

| 再生時 | プロキシ (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| 照合に使うもの | メソッド、パス、クエリ文字列の MD5 ハッシュ。ボディは比較しません。 | メソッド、URL、ボディ。続いて、共通するリクエストヘッダーが最も多いエントリを選びます。同じ URL とボディでも、ヘッダーで区別される別の操作であることがあるためです。どのエントリにもないボディはメソッドと URL での照合にフォールバックし、multipart の境界（boundary）は無視されます。 |
| 同じリクエストが再び来た場合 | 記録された順で次の記録。 | 記録された順で次の記録。書き込みには 1 つのルールがあります（後述）。 |
| 記録がない場合 | リクエストを示す JSON ボディ付きの 404。さらに `playwrightProxy.before()` がページを閉じるため、テストは即座に失敗します（`failOnMissingRecording: false` で無効にできます）。 | リクエストは中断され、`[Client-Side Replay] No recorded response for <method> <url>` がログに出力されます。 |
| 実際の API への到達 | `transparent` モードのときのみ。 | `url` に一致しないリクエストのみ。 |

### サーバーサイドのリクエスト（プロキシ）

キーは、メソッド、パス、そしてクエリ文字列の MD5 ハッシュの先頭 16 文字（16 進数）です。`GET /todos?page=2` のキーは `GET_todos_46589c7afd19c014.json` です。そのため、クエリ文字列が少しでも異なれば、パラメーターの順序の違いだけでも別のキーになります。

同じキーの呼び出しには、記録された順にレスポンスが返されます。最後の記録を超えた呼び出しには最後のレスポンスがもう一度返され、プロキシは `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one` とログに出力します。

記録のないリクエストは実際の API には到達しません。プロキシは `[REPLAY ERROR]` の行をログに出力し、404 で応答します:

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

プロキシがリクエストを実際のバックエンドへ送るのは `transparent` モードのときだけです。再生中の実行がそこに行き着く経路は 2 つあります。テストがまだ実行中に `playwrightProxy.teardown()` が実行される場合と、次の `playwrightProxy.before()` の呼び出しより前にセッションのタイムアウト（デフォルトは 120000 ms）が切れる場合です。どちらも [FAQ](/ja/docs/reference/faq/#parallel-replay) で説明しています。

### ブラウザのリクエスト（HAR）

`url` を渡すと、`playwrightProxy.before()` は一致するブラウザのリクエストを Playwright の HAR レコーダーで記録します:

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

再生には `page.routeFromHAR()` ではなく、このファイルを読むライブラリ独自の `page.route()` ハンドラーを使います。Playwright の再生は、同じリクエストが繰り返されるたびに最初に一致したエントリを返すため（[microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)）、`POST` の後の `GET` には `POST` 前の一覧が表示されていました。このハンドラーは代わりに、各記録を記録された順に 1 回ずつ返し、ページが記録時より多くリクエストした場合にのみ記録を再利用します。書き込みに対する読み取りの順序は 1 つのルールで決まります。あるパスへの書き込み（`GET`、`HEAD`、`OPTIONS` 以外のメソッド。そのため GraphQL のクエリも該当します）が再生されると、そのパスまたはその配下のパスへの読み取りは、書き込みの後に記録されたコピーを優先します。次の同様の書き込みまでに残りのコピーがない読み取りは、その書き込みより前の最新のコピーを再利用します。このルールにより、React の Strict Mode で fetch が二重に実行される場合のように、アプリの読み取り回数が記録時と異なっても再生は正しく保たれます。記録されたリダイレクトは `.har` の中でたどります。ブラウザの後続リクエストは `page.route()` に届かないためです。fetch は最終的なレスポンスを受け取り、ナビゲーションはリダイレクト先へ送られます。

`url` に一致するが `.har` にないリクエストは中断されます。`url` に一致しないリクエストはインターセプトされず、`transparent` モードではどのリクエストもインターセプトされません。これらは実際のネットワークに送られます。

プロキシ自体（`localhost:8100`）へのリクエストは例外です。`before()` は HAR のハンドラーの後にそれら専用のハンドラーを登録し、Playwright は後から登録されたハンドラーを先に実行します。このハンドラーはリクエストをプロキシへ転送し、プロキシはサーバーサイドのリクエストと同じように `.mock.json` から再生します。
