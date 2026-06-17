---
title: React Router / Remix
description: React Router 7（framework mode）と Remix の第一級の統合はロードマップにあります。それまでは、loader と action から記録セッションのヘッダーを手動で転送してください。
---

:::caution[ロードマップにあります]
React Router 7 framework mode（今日「Remix」が実際に意味するもの）の第一級アダプターは計画中ですが、まだ公開されていません。このページは今日機能する手動パターンを説明し、アダプターが登場したら専用ガイドに置き換えられます。早く欲しいですか? [issue を立ててください](https://github.com/asmyshlyaev177/test-proxy-recorder/issues)。
:::

React Router 7 の loader と action はサーバーで実行されるため、それらの `fetch` 呼び出しはブラウザのコンテキストなしでプロキシを通過します — [Next.js の SSR](/ja/docs/integrations/nextjs/) と同じ状況です。プロキシは、それらのサーバーサイドリクエストを正しい記録セッションに紐付けるために `x-test-rcrd-id` ヘッダーを必要とします。

## 手動パターン（今日機能します）

各 loader/action は受信した `request` を受け取ります。そこから記録 ID のヘッダーを読み取り、サーバーサイドの任意の `fetch` で転送してください:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

[手動セットアップ](/ja/docs/getting-started/manual-setup/)とまったく同様に、バックエンドのベース URL を開発/テストのみでプロキシ（`http://localhost:8100`）に向けてください。ブラウザサイドのリクエストは引き続き `playwrightProxy.before()` の HAR メカニズムで処理されます。

アダプターが登場すると、これはヘルパーの 1 つの import に簡略化されます — 進捗は[ロードマップ](https://github.com/asmyshlyaev177/test-proxy-recorder#readme)で追ってください。
