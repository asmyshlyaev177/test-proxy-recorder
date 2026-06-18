---
title: TanStack Start
description: TanStack Start の第一級の統合はロードマップにあります。それまでは、server functions から記録セッションのヘッダーを手動で伝播させてください。
---

:::caution[ロードマップにあります]
第一級の `test-proxy-recorder/tanstack-start` アダプターは計画中ですが、まだ公開されていません。このページは今日機能する手動パターンを説明し、アダプターが登場したら専用ガイドに置き換えられます。早く欲しいですか? [issue を立ててください](https://github.com/asmyshlyaev177/test-proxy-recorder/issues)。
:::

TanStack Start は loader と server functions をサーバーで実行するため、それらの `fetch` 呼び出しはブラウザのコンテキストなしでプロキシを通過します — [Next.js の SSR](/ja/docs/integrations/nextjs/) と同じ状況です。プロキシは、それらのサーバーサイドリクエストを正しい記録セッションに紐付けるために `x-test-rcrd-id` ヘッダーを必要とします。

## 手動パターン（今日機能します）

`playwrightProxy.before()` がブラウザの `page` に設定するヘッダーは、サーバーへの受信リクエストに届きます。そこで読み取り、サーバーサイドの任意の `fetch` で転送してください:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

[手動セットアップ](/ja/docs/getting-started/manual-setup/)とまったく同様に、バックエンドのベース URL を開発/テストのみでプロキシ（`http://localhost:8100`）に向けてください。ブラウザサイドのリクエストは引き続き `playwrightProxy.before()` の HAR メカニズムで処理されます。

アダプターが登場すると、これはヘルパーの 1 つの import に簡略化されます — 進捗は[ロードマップ](https://github.com/asmyshlyaev177/test-proxy-recorder#readme)で追ってください。
