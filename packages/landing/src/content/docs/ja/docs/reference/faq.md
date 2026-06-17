---
title: FAQ
description: test-proxy-recorder に関するよくある質問 — 並列再生、記録の git へのコミット、HAR 記録のためのプロキシターゲット、Next.js の開発サーバー、記録の更新。
---

## 並列の再生テストが時々実際のバックエンドを呼ぶのはなぜ? {#parallel-replay}

おそらくテストごとのフックで `playwrightProxy.teardown()` を呼んでいます。これはプロキシの**グローバル**モードを `transparent` に設定し、`fullyParallel: true` では各 Playwright ワーカーが自身の `test.afterAll` を実行します。速いテストが終わって `teardown()` を呼ぶ一方で遅いテストがまだ実行中だと、プロキシはテストの途中で transparent に切り替わり、残りのリクエストは再生されずに実際のバックエンドへ転送されます。

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**対処:** `test.afterAll` を省いてください。セッションのクリーンアップは `context.on('close')` → `cleanupSession()` で自動的に行われます。実行全体の後にプロキシをリセットする必要がある場合にのみ [global teardown](https://playwright.dev/docs/test-global-setup-teardown) を使ってください。

## 記録は git にコミットすべきですか?

はい。CI がネットワークなしで再生できるよう、記録は git に入っている必要があります — `e2e/recordings` を `.gitignore` に追加し**ないでください**。大きな記録ファイルが PR の差分を膨らませないよう、`.gitattributes` でバイナリとしてマークしてください:

```text
/e2e/recordings/** binary
```

## ブラウザのみ（HAR）の記録でプロキシの `<target-url>` は重要ですか?

いいえ。ブラウザのみの記録ではターゲットは無関係です — プロキシのプロセスは、セッション管理のために `/__control` エンドポイントが利用可能になるよう実行されている必要があるだけです。ターゲットが重要なのは、サーバーサイド（SSR）リクエストもプロキシ経由でルーティングする場合だけです。

## Next.js の開発サーバーに対して記録できますか?

記録・再生には `next dev` より `next build` + `next start` を推奨します。開発サーバーは遅く、タイムアウトや不安定な記録を引き起こすことがあります。

## 記録はどう更新しますか?

record モードで再実行し（フィクスチャで `MODE = 'record'`、または `RECORD_MODE=1`）実際の API に対して記録してから、replay に戻して `e2e/recordings/` の更新されたファイルをコミットしてください。
