---
title: Next.js
description: Next.js のサーバーサイドフェッチから記録セッションのヘッダーを伝播させ — ミドルウェア（推奨）または手動のヘッダー転送で — SSR リクエストを記録・再生します。
---

Next.js のような SSR フレームワークは、ブラウザのコンテキストなしでサーバーサイドの `fetch` 呼び出しを行い、それがプロキシを通過します。プロキシは `x-test-rcrd-id` ヘッダーによってそれらのリクエストがどのセッションに属するかを識別します — これは `playwrightProxy.before()` がブラウザの `page` に設定するのと同じヘッダーです。このヘッダーは **SSR でのみ必要**です — ブラウザのみのテストでは、プロキシは自動的にグローバルに設定されたセッションにフォールバックします。

SSR リクエストがこのヘッダーを運ぶには、次のいずれかを使ってください。

## ミドルウェア（推奨）

Next.js 16 はミドルウェアのエントリポイントとして `proxy.ts` を使います（エクスポートされる関数名は `proxy`）。`next.config.ts` と並んでプロジェクトのルートに置いてください:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

:::note[Next.js 15 以前]
エントリポイントは `middleware.ts` で関数名は `middleware` です — それ以外はすべて同じです:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}
```
:::

## 手動のヘッダー転送

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

`test-proxy-recorder/nextjs` ヘルパーの完全なシグネチャは [API リファレンス](/docs/reference/api/readme/)を参照してください。

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
