---
title: TanStack Start
description: TanStack Start のサーバーサイド fetch に記録セッションのヘッダーを付与して SSR を記録・再生します —— registerProxyFetch（推奨）または呼び出しごとの createHeadersWithRecordingId を使います。
---

TanStack Start は loader と server functions をサーバー上で実行するため、それらの `fetch` 呼び出しはブラウザーのコンテキストなしにプロキシを通ります —— [Next.js の SSR](/ja/docs/integrations/nextjs/) と同じ状況です。プロキシは `x-test-rcrd-id` ヘッダーによって、それらのリクエストがどのセッションに属するかを識別します。Playwright の `playwrightProxy.before()` は SSR を引き起こすブラウザーのナビゲーションに既にそれを設定しているので、id は入ってくるサーバーリクエストに届きます —— やるべきことは **それを送信するサーバーサイドのリクエストに付与する** ことです。（ブラウザーのみのテストにはこれは不要で、プロキシはグローバルに設定されたセッションにフォールバックします。）

:::caution[本番ビルドに対して記録する]
`vite dev` ではなく、`vite build` + `node .output/server/index.mjs`（つまり `pnpm start`）に対して記録してください。開発サーバーのリクエストごとのコンテキストは、`registerProxyFetch()` がパッチする本番ランタイムとは異なります。本番サーバーは本番モードで動くため、e2e 実行時にはアプリのプロセスに `TEST_PROXY_RECORDER_ENABLED=true` を設定してください。
:::

## registerProxyFetch（推奨）

**router のセットアップ**に 1 行加えるだけで、すべてのサーバーサイド `fetch` —— ルートの loader、server functions、server routes —— にタグを付けられます：

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // クライアント / 本番では TEST_PROXY_RECORDER_ENABLED=true でない限り no-op
```

これはグローバルな `fetch` をパッチして、現在のリクエストの `x-test-rcrd-id` を送信リクエストにコピーします。値は TanStack Start のサーバーリクエストコンテキスト（`getRequestHeader`）から読み取ります。`src/router.tsx` の先頭に置いてください —— このモジュールは SSR リクエストごとにサーバー上で実行されます。呼び出しは冪等で、クライアントでは no-op、本番でも記録器が明示的に有効化されていない限り no-op です。

## 呼び出しごと —— createHeadersWithRecordingId

パッチ不要です。loader や server function 内の単一の fetch に使うか、グローバルな `fetch` をパッチしたくない場合に使います：

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

生の id（または `null`）を自分で転送したい場合のために `getRecordingId()` もエクスポートしています。どちらもサーバーコンテキストから現在のリクエストの id を読み取り、どちらも本番では `TEST_PROXY_RECORDER_ENABLED=true` でない限り no-op です。

## アプリをプロキシに向ける

開発 / テストでは、バックエンドのベース URL をプロキシに向けて **両方** のオリジンが記録されるようにします —— サーバーサイドのベース（loader / server functions が読み取る、例：`BACKEND_URL`）と、ビルド時に埋め込まれるブラウザーサイドのベース（`VITE_API_URL`）です。本番では実際のバックエンドに向けます。ブラウザーサイドのリクエストは、[手動セットアップ](/ja/docs/getting-started/manual-setup/) とまったく同じく `playwrightProxy.before()` の HAR メカニズムで処理されます。

## 認証付きアプリ

記録器は [実際の認証プロバイダーと連携し](/ja/docs/getting-started/how-it-works/)（AWS Cognito、Auth0、Clerk、…）、上記の SSR タグ付けと組み合わせられます。パターンは次のとおりです：

- **`transparent` モードで、本物のログインを行う。** Playwright の `setup` プロジェクトがプロキシをパススルーにして一度だけログインするので、ログインは **記録されず**、認証済みのスペックが再利用するセッション（`storageState`）を保存します。
- **保護されたリクエストはトークンを運び、記録される。** 認証済みの各リクエストは `Authorization: Bearer …` ヘッダーを送り、記録器がそれを [秘匿する](/ja/docs/guides/secret-redaction/) ため、トークンはコミットされる記録に残りません。
- **トークンの置き場所がメカニズムを決める。** `localStorage` のトークンはサーバーで読めないため、保護された fetch はブラウザーで実行され、HAR で記録されます —— SSR プリフェッチはありません。一方、cookie ベースのセッションは `createHeadersWithRecordingId()` で loader に転送し、サーバーサイドで記録できます。

[`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) アプリには、まさにこれを示す実行可能な `/login` → `/dashboard` の AWS Cognito フロー（`e2e/setup-auth.ts` + `e2e/auth.spec.ts`）が含まれています。

## 完全な例

完全で実行可能なアプリ —— **TanStack Query**（SSR プリフェッチ + `useMutation`）で構築され、todos（ブラウザー + SSR）、キャッシュヘッダーベースの ISR ルート、レダクション（秘匿）のケース、WebSocket チャット、そして本物の AWS Cognito ログイン（transparent モードの認証 + トークンを秘匿して記録された保護 API）を網羅し、これらすべてを記録・再生できます —— は [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) にあります。これは記録器がデータ層に対して透過的であることを示します：`registerProxyFetch()` が SSR 中に Query の `queryFn` の fetch にタグを付け、Query 固有のコードは不要です。
