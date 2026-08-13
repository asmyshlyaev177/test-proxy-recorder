// Japanese (ja) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=ja source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Playwright の VCR — API レスポンスの記録・再生 | test-proxy-recorder',
    description:
      'Playwright 向けの VCR スタイルの記録・再生。実際の API レスポンスを一度キャプチャし、CI 上でバイト単位でそのまま決定論的に再生します — バックエンドもネットワークも手書きモックも不要。SSR プロキシ + ブラウザ HAR、WebSocket にも対応。MIT ライセンスで無料。',
    ogImageAlt:
      'test-proxy-recorder — record once, replay forever の見出しと、記録モードと再生モードの図。',
  },

  chrome: {
    skipToContent: '本文へスキップ',
    navQuickStart: 'クイックスタート',
    navDocs: 'ドキュメント',
    updated: '更新日',
    licensed: 'MIT ライセンス。',
    languageLabel: '言語',
  },

  hero: {
    eyebrow: 'Playwright の VCR',
    headlineTop: '一度記録する。',
    headlineBottom: 'ずっと再生する。',
    sub: 'Playwright スイートをローカルで実行しながら実際の API レスポンスをキャプチャし、CI 上でバイト単位でそのまま再生します。バックエンド不要、ネットワーク不要、保守すべき手書きモックも不要。',
    copyLabel: 'コピー',
    starCta: 'GitHub でスター',
    starCountAlt: 'GitHub のスター数',
    fine: 'MIT · TypeScript · Next.js と TanStack Start の SSR、SPA、Chrome 拡張に対応 · WebSocket 対応',
  },

  demo: {
    heading: '記録、そして再生の様子を見る',
    sub: '1 回の Playwright 実行で実際のレスポンスをディスクに記録し、再生に切り替えれば同じスイートがバックエンドをオフにしたまま通過します — ネットワーク不要。',
    videoLabel:
      '画面録画: test-proxy-recorder で実際の API レスポンスを記録し、バックエンドをオフにして再生する様子。',
  },

  mechanisms: {
    heading: '2 つのレコーダー、1 つのプロキシ',
    sub: 'リクエストは 2 つの場所から発生するため、記録の仕組みも 2 つあります。どちらか、または両方を併用できます。どちらも一度記録してディスクから再生するため、CI はバックエンドをオフにしたまま手書きモックなしで実行されます。',
    proxy: {
      title: 'プロキシ',
      flow: 'Next.js / TanStack Start SSR → プロキシ → 実際の API',
      body: 'サーバーと API の間に位置します。サーバーサイドのリクエスト — SSR フェッチ、ルートハンドラー、バックエンド・フォー・フロントエンドが呼び出すあらゆるものを記録します。',
      when: 'サーバーが API を呼び出すフルスタックアプリ向け。',
      exampleNextjs: 'Next.js の例を見る →',
      exampleTanstack: 'TanStack Start の例を見る →',
    },
    har: {
      title: 'HAR',
      flow: 'ブラウザ → HAR 傍受 → 実際の API',
      bodyStart: 'ブラウザ自体の中で傍受します。クライアントサイドの',
      bodyEnd:
        '呼び出し、Chrome 拡張の API トラフィック、アナリティクス、サードパーティ API を記録します。',
      when: 'SPA、拡張、ブラウザのみのアプリ向け。',
      exampleExtension: 'Chrome 拡張の例を見る →',
    },
  },

  compare: {
    heading: '適している場面',
    sub: 'モックツールはそれぞれ得意分野が異なります。以下の組み合わせ — SSR、ブラウザ、WebSocket にまたがって実際のトラフィックを記録し、手書きモックを必要としないこと — こそが、他のツールが埋められていない空白です。',
    tableCaption:
      'test-proxy-recorder と Playwright の routeFromHAR、MSW、Polly.js、playwright-network-cache、Mocky Balboa との機能比較。',
    featureLabel: '機能',
    features: [
      '実際のトラフィックを記録',
      'サーバーサイド (SSR)',
      'ブラウザサイド',
      'WebSocket',
      'Playwright ネイティブ',
      'メンテナンス状況',
    ],
    markText: { y: '対応', n: '非対応', p: '部分的' },
    footStart:
      'Polly.js は Node の HTTP を傍受するため、SSR のモックはアプリプロセス内では可能ですが、Playwright 実行の一部としてはできません。MSW と Mocky Balboa も実際のレスポンスを再生します — ただしモックを手書きする必要があります。いつ他のツールを選ぶべきかは、',
    footLinkLabel: 'ドキュメント',
    footEnd: 'で説明されています。',
  },

  auth: {
    heading: '実際の認証プロバイダーと連携',
    sub: 'Cognito、Auth0、Clerk、WorkOS を通じて、毎回の実行で本物のログインを行います。記録されるのはアプリの API だけで、認証はライブのまま、データはオフラインで再生されます。',
    links: {
      cognito: 'AWS Cognito の例 →',
      tanstack: 'TanStack Start 上の Cognito →',
      mock: 'モック認証（クラウドアカウント不要）→',
    },
  },

  quickStart: {
    heading: '3 ステップでセットアップ',
    subStart:
      '1 つのコマンドですべてをスキャフォールドし、API をプロキシに向け、記録してコミットします。ブラウザのみのアプリですか?',
    subEnd: 'は SSR の手順をスキップしてくれます。',
    ai: {
      heading: '最速の方法: AI エージェントに任せる',
      noteStart:
        'これをコピーし、バックエンド URL を差し替えて、Claude Code、Cursor、または任意のコーディングエージェントに貼り付けてください — エージェントは',
      noteMid: 'を実行し、',
      noteEnd: 'が表示するプロンプトに従って配線を完了させます。',
      copyLabel: 'コピー',
    },
    manualIntro: 'または手動で配線する:',
    steps: {
      install: {
        title: 'インストールとスキャフォールド',
        noteStart: 'は、プロキシ設定、Playwright フィクスチャ、グローバルティアダウン、',
        noteEnd:
          'のスクリプトを作成し、（Next.js では）SSR フェッチのタグ付けをルートレイアウトに配線します — 非破壊的に。',
      },
      apiEnv: {
        title: 'アプリの API をプロキシに向ける',
        noteStart: '',
        noteEnd:
          'が推測できない唯一のものは、どの環境変数が API のベース URL を保持しているかです。レコーダーが有効な場合はプロキシを指し、それ以外の場合は実際のバックエンドを指します — プロキシは本番環境では決して動きません。',
        ssrStart: 'Next.js では、',
        ssrAfterInit: 'は',
        ssrAfterFn: 'もルートレイアウトに追加して、サーバーサイドの',
        ssrEnd: '呼び出しをタグ付けします — 本番では no-op です:',
      },
      record: {
        title: '記録、コミット、再生',
        noteStart: '',
        noteMid: 'に設定し、実際の API に対して一度実行し、その後',
        noteEnd:
          'に切り替えてコミットします。記録は git に保存されます — これが CI を決定論的にするものです。gitignore に追加しないでください。',
      },
    },
  },

  cta: {
    heading: '手書きモックをやめる',
    sub: 'API はすでに正しい答えを返しています。それを記録しましょう。',
    copyLabel: 'コピー',
    starCta: 'GitHub でスター',
    fineStart:
      '午後の時間が節約できたなら、スターは 1 秒で済みます — 次の人が見つける手段であり、1 人で保守を続ける者への「作り続けて」という合図です。つまずいたりアイデアがあれば、',
    issueLabel: 'issue を開く',
    fineBetween: 'か',
    discordLabel: 'Discord に参加',
    fineEnd: 'してください。',
  },
};
