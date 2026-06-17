---
title: サンプルアプリ
description: test-proxy-recorder の完全に動作するサンプル — Next.js SSR、Chrome 拡張、サードパーティの WebSocket ティッカー、そしてバックエンドなしで再生される認証済みアプリ。
---

完全に動作するサンプルは [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) にあります — 記録メカニズムごとに 1 つ。それぞれ、完全なセットアップと記録/再生のワークフローを記した独自の README を備えています。

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — モックバックエンド、プロキシ、Playwright の e2e テストを備えた Next.js 16 の ToDo アプリ。SSR フェッチ（`.mock.json`）とブラウザフェッチ（`.har`）の両方を記録し、ローカルバックエンドに対する WebSocket チャットを含みます。[README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md) を参照。

## Chrome 拡張 {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — content script から X/Twitter の API を呼ぶ実際の Chrome 拡張。ブラウザのリクエストは `.har` に記録され、ライブ API や CI 上のアカウントなしでオフライン再生されます。[README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md) を参照。

## 暗号ティッカー — サードパーティ WebSocket {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — Binance の公開 WebSocket フィードに支えられたライブの BTC-USD 価格ティッカー。実際のフィードをプロキシ経由で一度記録し、ネットワークも取引所アカウントもなしで CI 上で決定論的な価格を再生します。[README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md) を参照。

## 認証済みアプリ {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — **実際の AWS Cognito** ユーザープールにログインし、保護された API を記録/再生する Next.js アプリ。ログインは毎回ライブのまま（記録されません）で、保護データはバックエンドをオフにして再生され、認証トークンは記録から編集されます。統合はごく少数のファイルだけです — [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md) を参照。**クラウドアカウント不要**の同じパターンは [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock) を参照してください。
