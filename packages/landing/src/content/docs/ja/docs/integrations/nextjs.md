---
title: Next.js
description: Next.js のサーバーサイドフェッチに記録セッションヘッダーを付与し、SSR を記録・再生します — registerProxyFetch（推奨、任意のランタイム）、axios 向け registerProxyAxios、または 1 回ごとの createHeadersWithRecordingId で。ミドルウェアは任意です。
---

Next.js のような SSR フレームワークは、ブラウザのコンテキストなしでサーバーサイドの `fetch` 呼び出しを行い、それがプロキシを通過します。プロキシは `x-test-rcrd-id` ヘッダーによってそれらのリクエストがどのセッションに属するかを識別します。Playwright の `playwrightProxy.before()` はすでに SSR を引き起こすブラウザのナビゲーションにそれを設定しているため、id は `next/headers` で利用できます — 仕事は**送信するサーバーサイドリクエストにそれを付与すること**です。（ブラウザのみのテストにはこれらは不要です。プロキシはグローバルに設定されたセッションにフォールバックします。）

:::tip
[`test-proxy-recorder init`](/ja/docs/getting-started/quick-start/) は Next.js を検出し、以下の推奨アプローチをルートレイアウトに自動的に組み込みます。
:::

:::caution[本番ビルドに対して記録する]
`next dev` ではなく `next build && next start` で記録してください。開発サーバーはリクエスト間でグローバル `fetch` パッチをリセットすることがあり（[vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)）、遅く不安定になります。`next start` は本番モードで動くため、e2e 実行のアプリプロセスに `TEST_PROXY_RECORDER_ENABLED=true` を設定してください。
:::

## registerProxyFetch（推奨）

**ルートレイアウト**に 1 行追加するだけで、すべてのサーバーサイド `fetch` — Server Components、Route Handlers、Node と Edge の両方のランタイム — にタグ付けします:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true
```

これはグローバル `fetch` にパッチを当て、現在のリクエストの `x-test-rcrd-id` を送信リクエストにコピーするので、プロキシは並行する再生セッションを区別できます。ルートレイアウトから呼んでください — `instrumentation.ts` ではなく、そこのコンテキストは Edge ランタイムでルートをレンダリングするものと異なるため、そこでパッチしても暗黙に発火しません。

## axios — registerProxyAxios

サーバーサイドのリクエストが axios 経由の場合、各サーバーサイドインスタンスを一度だけ登録してください:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

id をスタンプするリクエストインターセプターを追加します（グローバル `fetch` には触れない）ので、上記の開発サーバーの注意点の影響を受けません。本番 / ブラウザでは no-op、インスタンスごとに冪等、呼び出し元が設定した id は上書きしません。

## 1 回ごと — createHeadersWithRecordingId

パッチ不要で、`next dev` でも動作します。単一の fetch に使うか、グローバル `fetch` にパッチを当てたくない場合に使ってください:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## ミドルウェア（任意）

`proxy.ts`（Next.js 16+、エクスポートは `proxy`）または `middleware.ts`（15 以前、エクスポートは `middleware`）から `setNextProxyHeaders` を呼ぶと、`next/headers` 経由で id を利用できるようにしますが、**送信フェッチにはタグ付けしません** — したがって上記のヘルパーのいずれかを使う場合は必須ではありません。すでにミドルウェア（認証など）を持っている場合にのみ利用し、その場合もタグ付けにはヘルパーと併用してください:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // exposes the id; pair with a helper above
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`test-proxy-recorder/nextjs` ヘルパーの完全なシグネチャは [API リファレンス](/ja/docs/reference/api/readme/)を参照してください。完全に実行可能な Edge プロジェクトは [Edge ランタイムの例](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge)にあります。

## package.json スクリプト

サービスは `playwright.config.ts` からではなくスクリプトから起動してください:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

完全に実行可能なプロジェクトは [Next.js 16 の例](/ja/docs/reference/examples/#nextjs-16)にあります。
