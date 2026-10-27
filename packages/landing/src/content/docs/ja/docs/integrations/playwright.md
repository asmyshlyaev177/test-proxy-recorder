---
title: 'Playwright のセットアップ: テストごとに記録・再生する'
description: test-proxy-recorder で Playwright テストの API 呼び出しを記録・再生します。before() セッションフック、推奨される global teardown、テストごとの記録ファイルを使います。
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 41506a06c67c43287c172907f5ef6c6ef07e36e3
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

**例外 — フルスタックアプリ:** ブラウザも `localhost:8100` を呼ぶ場合（フロントエンドがプロキシ URL を API ベースとして設定しているため）、パターンには `/localhost:8100/` を使ってください。その場合、それらのブラウザのリクエストはプロキシにそのまま渡され、プロキシがテストの `.mock.json` に記録し、そこから再生します。そのため、記録のないリクエストは HAR による中断ではなくプロキシの 404 を受け取ります（[再生時のリクエストの照合](/ja/docs/getting-started/how-it-works/#replay-matching)を参照）。

記録ファイル名は、テストファイル、`describe` のタイトル、テストのタイトルから作られます（`users.spec.ts` › `create a user` → `users__create-a-user.mock.json` / `.har`）。120 バイトを超える名前は切り詰められ、末尾にハッシュが付きます。

## 記録のないテスト

再生時、テストに記録がない場合、`before()` はプロキシを切り替える前に例外を投げます:

```text
[test-proxy-recorder] This test has no recording: <recordingsDir>/users__create-a-user.mock.json does not exist. Record this test first.
```

テストをスキップせずに記録してください。スキップしたテストは失敗ではなくスキップとして報告されるため、記録の欠落に気付けません。`hasRecording(testInfo)` は、再生と同じファイル名を使って、例外を投げずに同じ判定を返します。

## Global teardown（推奨） {#global-teardown-recommended}

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

`teardown()` はプロキシを `transparent` にリセットし、HAR の[マスキング](/ja/docs/guides/secret-redaction/)パスを実行します。`transparent` への切り替えにより、すべての記録セッションが保存されて終了します。`fullyParallel` 下でテストごとの `afterAll` フックでは呼ばないでください — それが並列の再生と記録を壊す理由は[FAQ](/ja/docs/reference/faq/#parallel-replay)を参照してください。

## 記録ファイル

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
