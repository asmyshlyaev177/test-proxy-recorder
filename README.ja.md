<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · 日本語 · [한국어](./README.ko.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=ja source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **Playwright の VCR** — 実際の API レスポンスを一度記録し、CI 上で決定論的に再生します。Next.js と TanStack Start の SSR、ブラウザ、WebSocket のトラフィックをカバーします。バックエンド不要、手書きモック不要。

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="実際の API レスポンスを記録し、バックエンドをオフにした CI 上で再生している様子" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## なぜ

フレーキーな e2e 実行にはすべて同じ根本原因があります: ネットワークです。これは実際のトラフィックを一度記録し、CI 上でバイト単位でそのまま再生します — バックエンドをオフにしたままテストが通るように。

- **CI でバックエンド不要** — ディスクから再生し、ネットワークを使いません。
- **手書きモック不要** — 実際のやりとりをキャプチャし、フィクスチャを手書きしません。
- **SSR + ブラウザ + WebSocket** — リクエストが発生する場所ならどこでも記録します。

## 比較

test-proxy-recorder は、手書きモックなしで SSR、ブラウザ、WebSocket にまたがる **実際の** トラフィックを記録する唯一のツールです — その組み合わせこそ、他のツールが埋めていない空白です。

| 機能 | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 実際のトラフィックを記録 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| サーバーサイド (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| ブラウザサイド | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Playwright ネイティブ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| メンテナンス状況 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js は Node の HTTP を傍受するため、SSR のモックはアプリプロセス内では可能ですが、Playwright 実行の一部としてはできません。MSW と Mocky Balboa も実際のレスポンスを再生します — ただし記録するのではなくモックを手書きします。

[ドキュメントの完全な比較](https://test-proxy-recorder.dev/docs/#comparison) — いつ他のツールを選ぶべきかも含めて — をご覧ください。

## クイックスタート

**最速の方法 — AI コーディングエージェントに任せる。** これをコピーし、バックエンド URL を差し替えて、Claude Code / Cursor などに貼り付けてください（`init` を実行し、配線を完了させます）:

```text
# このプロジェクトで e2e テスト用に test-proxy-recorder をセットアップし、`init` が表示する指示に従ってください。次のコマンドを実行します:
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# その後、init が表示する手順を完了します: アプリの API ベース URL を開発/テスト時のみプロキシに向け、サーバーサイドフェッチにタグ付けし（Next.js）、スモークテストを追加し、記録 → 再生を確認します。
```

手動で配線する場合:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` はすべてを非破壊的にスキャフォールドします: プロキシ設定、Playwright フィクスチャ、グローバルティアダウン、`package.json` のスクリプト、そして（Next.js では）`registerProxyFetch()` を使って SSR フェッチのタグ付けをルートレイアウトに配線します。最後に、推測できないアプリ固有の手順のための AI エージェント向けプロンプトを表示します。

`init` が推測できない唯一のものは、API のベース URL を保持する環境変数です。レコーダーが有効な場合はプロキシを指し、それ以外の場合は実際のバックエンドを指します — プロキシは本番環境では決して動きません:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init` で指定したプロキシアドレス
```

その後、`MODE = 'record'` に設定し、実際の API に対して一度実行し、`'replay'` に切り替えて、`e2e/recordings/` をコミットします。CI はこれでバックエンドをオフにしたまま実行されます。

詳しい手順: [クイックスタート](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [手動セットアップ](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/)。

> **手書きモックを書く午後が丸ごと節約できましたか?**
> [GitHub の ⭐](https://github.com/asmyshlyaev177/test-proxy-recorder) は 1 秒で押せます。フレーキーな e2e テストに悩む次の人がこれを見つける手段になります。私は 1 人で保守しており、すべてのスターを「続けよう」という合図として読んでいます。

## サンプル

[`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) にある完全に動作するアプリ。それぞれ独自の README を備えています:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + ブラウザ + WebSocket チャット
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — 並行再生のための `registerProxyFetch`
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + ブラウザ、TanStack Query、ISR、WebSocket、実際の Cognito ログイン
- [Chrome 拡張](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — ブラウザのみ、オフラインで再生
- [暗号ティッカー](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — サードパーティの WebSocket フィード
- [認証済みアプリ](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — 実際の Cognito ログイン、保護 API を再生

## ドキュメント

その他すべては [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/) にあります: [仕組み](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/)、[CLI](https://test-proxy-recorder.dev/docs/guides/cli/)、[設定](https://test-proxy-recorder.dev/docs/guides/config/)、[シークレットのマスキング](https://test-proxy-recorder.dev/docs/guides/secret-redaction/)、[Next.js 統合](https://test-proxy-recorder.dev/docs/integrations/nextjs/)、[TanStack Start 統合](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/)、[API リファレンス](https://test-proxy-recorder.dev/docs/reference/api/readme/)、[FAQ](https://test-proxy-recorder.dev/docs/reference/faq/)。

AI コーディングエージェントを使っていますか? `npx @tanstack/intent@latest install` でスキルが追加され、正しいセットアップコードを生成できるようになります。[AI エージェントスキルガイド](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/) をご覧ください。

## 要件

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0（ピア依存関係）

## フィードバックとコントリビューション

これは 1 人の人間によってオープンに開発・保守されており、あらゆるフィードバックが次に何を作るかを方向づけます:

- **[⭐ リポジトリにスター](https://github.com/asmyshlyaev177/test-proxy-recorder)** — 支援する最速の方法であり、他の人が見つけるのに本当に役立ちます。
- **つまずいたりアイデアがありますか?** [issue を開く](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) か、[Discord](https://discord.gg/w7rgYbY5zz) で声をかけてください — 一行の「ここで混乱した」だけでも貴重です。
- **コントリビュートしたいですか?** PR を歓迎します。

## AI スキル

AI コーディングエージェント（Claude Code、Cursor、Copilot など）を使っていますか? このライブラリは [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) のスキルを同梱しており、エージェントが正しいセットアップコードを生成できるようになります。パッケージをインストールし、エージェント向けガイダンスを書き込みます:

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` はスキル検出のガイダンスをエージェント設定（`CLAUDE.md`、`.cursorrules` など）に追加します。エージェントは `proxy-setup`、`nextjs-ssr`、`tanstack-start` の各スキルをオンデマンドで読み込みます。`npx @tanstack/intent@latest list` と `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup` で直接一覧表示や読み込みができます。詳しいガイド: [AI エージェントスキル](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/)。

スキルのソースは [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/) にあります。

## 私を雇ってください

私は **Aleksandr Smyshliaev** です — このツールの作者兼メンテナーです。シニアフロントエンドエンジニア（React / Next.js / TypeScript、8 年以上）で、**現在フルタイムのリモートワークを募集中です**。

このプロジェクトは、私が何年も他人のフレーキーなテストスイートを直してきた経験から生まれました。それが私の最も得意とする仕事です: 半年後にコードベースがまだ快適かどうかを左右する、地味なインフラストラクチャです。

- **得意分野** — コンポーネントライブラリ、状態管理、リファクタリングに耐えるテストスイート。
- **その他のプロジェクト** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  （週間インストール数 約 84k）、
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url)（型付き URL
  状態）、[llm-queue](https://github.com/asmyshlyaev177/llm-queue)。
- **所在地** — ジョージアのトビリシ（GMT+4）。CET と完全に重なります。契約事業体として登録済みのため、B2B 契約に employer-of-record の設定は不要です。
- **連絡先** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## ライセンス

MIT
