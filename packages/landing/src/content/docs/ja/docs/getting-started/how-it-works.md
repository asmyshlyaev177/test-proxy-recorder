---
title: 仕組み
description: test-proxy-recorder は 2 つのメカニズムでトラフィックを記録します — サーバーサイドのリクエスト用のプロキシと、ブラウザサイドのリクエスト用の HAR。併用も単独使用も可能です。
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

各モードはテストセッションごとに設定します。**record** モードではプロキシは実際のバックエンドへ転送してレスポンスを保存し、**replay** モードでは保存済みのレスポンスをディスクから提供し、**transparent** モードでは記録せずに転送します。モードの切り替え方法は[コントロールエンドポイント](/ja/docs/guides/control-endpoint/)を参照してください。
