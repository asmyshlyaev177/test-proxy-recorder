---
title: Playwright
description: Playwright のテストから test-proxy-recorder を使う — before() セッションフック、推奨される global teardown、記録ファイルの保存場所。
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

各テストの先頭（または `beforeEach` / ページフィクスチャ）で呼び出します。セッションのプロキシモードを設定し、`url` が指定されていればブラウザサイドのリクエスト用に HAR 記録をセットアップします。

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**`url` パターン:** ブラウザが呼び出す実際の外部ドメインにマッチします。record モードではリクエストは実際の API へ行き、`.har` ファイルに保存されます。replay モードではそのファイルから提供されます — ネットワーク不要。このパターンはプロキシ（`localhost:8100`）を指し**ません**。

**例外 — フルスタックアプリ:** ブラウザも `localhost:8100` を呼ぶ場合（フロントエンドがプロキシ URL を API ベースとして設定しているため）、パターンには `/localhost:8100/` を使ってください。

記録ファイル名はテスト名から導かれます（`"create a user"` → `create-a-user.mock.json` / `.har`）。

## Global teardown（推奨）

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` はプロキシを `transparent` にリセットし、HAR の[編集](/ja/docs/guides/secret-redaction/)パスを実行します。`fullyParallel` 下でテストごとの `afterAll` フックでは呼ばないでください — それが並列再生を壊す理由は[FAQ](/ja/docs/reference/faq/#parallel-replay)を参照してください。

## 記録ファイル

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
