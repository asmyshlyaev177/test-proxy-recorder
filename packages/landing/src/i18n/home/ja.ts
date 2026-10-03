// Japanese (ja) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=ja source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Playwright で API 呼び出しを SSR も含めて記録・再生',
    description:
      'Playwright テストの実行中に実際の API レスポンスを記録し、CI で再生します。Next.js と TanStack Start のサーバーサイドフェッチ、ブラウザからの呼び出し、WebSocket に対応しています。',
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
    copied: 'コピーしました',
  },

  hero: {
    title: 'Playwright テストの API 呼び出しを、サーバーサイドのリクエストも含めて記録・再生',
    headlineTop: '一度記録する。',
    headlineBottom: 'ずっと再生する。',
    sub: 'ローカルでの Playwright 実行中にアプリが受け取る API レスポンスを WebSocket も含めて記録し、CI ではバックエンドをオフにしたまま再生します。',
    copyLabel: 'コピー',
    starCta: 'GitHub でスター',
    fine: 'MIT · TypeScript · Node ≥ 20 · Next.js と TanStack Start の SSR、SPA、Chrome 拡張、WebSocket',
    scenePause: '一時停止',
    scenePlay: '再生',
  },

  demo: {
    heading: '記録、そして再生の様子を見る',
    sub: '1 回の Playwright 実行で実際のレスポンスをディスクに記録し、再生に切り替えれば同じスイートがバックエンドをオフにしたまま通過します。',
    videoLabel:
      '画面録画: test-proxy-recorder で実際の API レスポンスを記録し、バックエンドをオフにして再生する様子。',
  },

  mechanisms: {
    heading: '2 つの記録方法',
    sub: 'リクエストは 2 つの場所から発生するため、記録の方法も 2 つあり、どちらの方法でもプロキシのプロセスが動きます。プロキシに送られたもの（サーバーサイドフェッチ、サーバーと共通の API ベース URL を経由するブラウザからの呼び出し、WebSocket）は、そのテストの .mock.json から再生されます。フィクスチャの url パターンに一致する、他のホストへのブラウザからの呼び出しは、そのテストの .har から再生されます。',
    proxy: {
      title: 'プロキシ',
      flow: 'Next.js / TanStack Start SSR → プロキシ → 実際の API',
      body: 'サーバーと API の間に位置し、サーバーサイドのリクエストを記録します。Server Component と SSR のフェッチ、ルートハンドラー、バックエンド・フォー・フロントエンドが呼び出すあらゆるものが対象です。',
      when: 'サーバーが API を呼び出すフルスタックアプリ向け。',
      parallel: '各テストのサーバーサイドのリクエストにはそのテストの id が付くため、並列に実行されるテストが記録を共有することはありません。',
      guideNextjs: 'Next.js ガイド →',
      guideTanstack: 'TanStack Start ガイド →',
      exampleNextjs: 'Next.js の例を見る →',
      exampleTanstack: 'TanStack Start の例を見る →',
    },
    har: {
      title: 'HAR',
      flow: 'ブラウザ → HAR 傍受 → 実際の API',
      bodyStart: 'ブラウザ自体の中で傍受し、HTTP Archive（HAR）ファイルに保存します。クライアントサイドの',
      bodyEnd:
        '呼び出し、Chrome 拡張の API トラフィック、アナリティクス、サードパーティ API のうち、フィクスチャの url パターンに一致するものを記録します。',
      when: 'SPA、拡張、ブラウザのみのアプリ向け。',
      proxyNote:
        'routeFromHAR を単体で使う場合に比べ、テストごとに HAR を 1 つずつ分け、認証ヘッダーをマスキングする機能が加わります。',
      guidePlaywright: 'Playwright ガイド →',
      exampleExtension: 'Chrome 拡張の例を見る →',
      exampleVite: 'Vite + WebSocket の例を見る →',
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
      'Polly.js は自身が動いているプロセスの中で記録するため、サーバーサイドのリクエストに使うにはアプリのサーバー内で動かす必要があります。MSW と Mocky Balboa もサーバーサイドのリクエストをモックできますが、レスポンスは自分で書きます。出典と、他のツールを選ぶべき場面を含む完全な比較は',
    footLinkLabel: 'ドキュメント',
    footEnd: 'にあります。',
    tradeoff:
      'トレードオフとして、ブラウザのみを対象とするツールよりも最初のセットアップに手間がかかります。テストと並行してプロキシのプロセスが動き、サーバーサイドのリクエストについては、テスト実行中はアプリの API ベース URL をプロキシに向けます。',
  },

  auth: {
    heading: '実際の認証プロバイダーと連携',
    sub: 'Cognito、Auth0、Clerk、WorkOS を通じて、毎回の実行で本物のログインを行います。記録されるのはアプリの API だけで、認証はライブのまま、データはオフラインで再生されます。',
    links: {
      cognito: 'AWS Cognito の例 →',
      tanstack: 'TanStack Start 上の Cognito →',
      mock: 'モック認証（クラウドアカウント不要） →',
    },
  },

  recordingSample: {
    heading: '記録ファイルの中身',
    perTest: {
      term: 'テストごとに 1 ファイル',
      start: '各テストはテスト名に基づいた名前の専用ファイルに書き込むため、',
      end: 'でそのテストだけを記録し直せます。プロキシは一度に 1 つのテストしか記録しないため、記録はワーカー 1 つで行ってください。再生は並列で実行できます。',
    },
    testId: {
      term: 'テストの id',
      start: 'Playwright はテストが行うすべてのリクエストに',
      mid: 'を付けて送り、',
      end: 'がそれをサーバー自身のフェッチにコピーします。プロキシはこれを読み取り、テストを並列に再生しているときでも、各テストにそのテスト専用のファイルから応答します。',
    },
    secrets: {
      term: 'シークレット',
      body: 'Authorization、Cookie、Set-Cookie ヘッダーの値は、.mock.json ファイルでは書き込まれる前に、.har ファイルでは実行の終了時に [REDACTED] に置き換えられます。レスポンスボディ内のシークレットには独自のパターンが必要です。',
      link: 'シークレットのマスキング →',
    },
    caption:
      '実際の記録の一部です（全体は 2.6 KB）。1 つのテストの POST で、Authorization ヘッダーはマスキングされています。ファイル全体には、その後に続いた GET、すべてのヘッダー、各リクエストのタイムスタンプも含まれます。',
  },

  replayQuestions: {
    heading: '再生についての質問',
    matching: {
      term: 'リクエストはどう照合されますか?',
      body: 'プロキシはサーバーサイドの呼び出しを、メソッド、パス、クエリ文字列の完全一致で照合し、ボディは比較しません。繰り返された呼び出しには、記録された順にレスポンスを返します。ブラウザからの呼び出しは Playwright の HAR のルールに従い、こちらは POST のボディも比較します。タイムスタンプのように実行のたびに変わるクエリ文字列は一致することがなく、パラメーターを無視するオプションもないため、そうした値はテスト中は固定してください。',
      link: '再生時のリクエストの照合 →',
    },
    misses: {
      term: '記録がない場合はどうなりますか?',
      start:
        'プロキシは 404 を返し、該当するリクエストとテストを示します。記録された回数より多く行われた呼び出しには最後のレスポンスがもう一度返され、プロキシのログに警告が出ます。ブラウザでは、Playwright は',
      mid: 'パターン（フィクスチャが',
      end: 'に渡すもの）に一致し、かつ HAR にない呼び出しを中断します。それ以外の呼び出しはネットワークに到達します。',
    },
    liveApi: {
      term: '再生が実際の API に到達するのはどんなときですか?',
      start:
        '再生が実際の API に到達するのは、プロキシが再生モードを抜けた後だけです。プロキシは実行中のすべてのテストに対して 1 つのモードを保持します。再生モードを抜けるのは、最後のテストが開始してから 120 秒後か、テストごとのフックが',
      end: ' を呼んだときです。CI でバックエンドが動いていなければ、そうした呼び出しは通らずに失敗します。',
      link: 'セッションのタイムアウトと teardown →',
    },
    drift: {
      term: 'API が変わったらどうなりますか?',
      body: '型付きの API クライアントを使っている場合、変更されたフィールドに合わせてクライアントを更新すると、そのフィールドを使う再生テストが失敗します。記録には古いフィールドが残っているためです。これで変更箇所がわかり、記録し直せば、手書きのモックを編集するより少ない手間でテストが直ります。',
    },
    overrides: {
      term: 'エラーやエッジケースはどうテストしますか?',
      start: 'ブラウザでは、',
      mid: 'を',
      end: 'の後に登録すると、そのハンドラーが記録より優先されます。サーバーサイドのレスポンスは .mock.json ファイルで編集します。',
      link: 'レスポンスを強制する →',
    },
  },

  quickStart: {
    heading: 'クイックスタート',
    subStart:
      '1 つのコマンドですべてをスキャフォールドし、API をプロキシに向け、記録してコミットします。ブラウザのみのアプリですか?',
    subEnd: 'は SSR の手順をスキップしてくれます。',
    tabs: {
      agent: 'AI エージェントで',
      manual: '手動で',
    },
    ai: {
      noteStart:
        'これを Claude Code、Cursor などのコーディングエージェントに貼り付けてください。エージェントはまず @tanstack/intent を実行します。これはエージェントの設定ファイル（CLAUDE.md など）にガイダンスを追加し、エージェントがこのライブラリのセットアップ用スキルを読み込むようにします。続いてパッケージをインストールし、アプリの設定からバックエンドの URL を見つけ、',
      noteEnd: 'を実行し、その出力に従って配線を完了させます。',
      copyLabel: 'プロンプトをコピー',
    },
    changes: {
      label: 'リポジトリで変わること',
      tests:
        'テストスイート: Playwright フィクスチャ、プロキシのプロセス（テスト中にのみ動作します）、git にコミットされる記録。',
      appStart:
        'アプリ（サーバーサイドのリクエストについてのみ）: テスト実行中は API ベース URL をプロキシに向け、Next.js では app/layout.tsx、TanStack Start では src/router.tsx で',
      appEnd:
        'を 1 回呼び出します。これはテストの id を各サーバーサイドフェッチにコピーし、TEST_PROXY_RECORDER_ENABLED が設定されていない限り、本番では何もしません。',
      agent:
        'エージェント用プロンプトを使う場合: @tanstack/intent が、このライブラリのスキルを読み込むためのガイダンスをエージェントの設定ファイル（CLAUDE.md など）に追加します。',
      deployed:
        'デプロイ済みの環境をテストしますか? HAR はアプリを変更せずに、その環境のブラウザからの呼び出しを記録しますが、ページ自体は引き続きそのサーバーから読み込まれます。サーバーサイドの呼び出しも再生するには、CI でプロキシと並べてアプリを実行してください。',
    },
    steps: {
      install: {
        title: 'インストールとスキャフォールド',
        noteStart: 'は、プロキシ設定、Playwright フィクスチャ、グローバルティアダウン、',
        noteEnd:
          'のスクリプトを作成し、（Next.js では）SSR フェッチのタグ付けをルートレイアウトに配線します — 非破壊的に。',
      },
      apiEnv: {
        title: 'サーバーサイドの API 呼び出しをプロキシに向ける',
        noteStart: '',
        noteEnd:
          'が推測できない唯一のものは、どの環境変数が API のベース URL を保持しているかです。レコーダーが有効な場合はプロキシを指し、それ以外の場合は実際のバックエンドを指します — プロキシは本番環境では決して動きません。',
        ssrStart: 'Next.js では、',
        ssrAfterInit: 'は',
        ssrAfterFn: 'もルートレイアウトに追加して、サーバーサイドの',
        ssrEnd: '呼び出しをタグ付けします — 本番では no-op です。',
        browserOnly:
          'ブラウザのみのアプリですか? アプリが WebSocket を開く場合を除き、この手順は省略できます。WebSocket は、プロキシのアドレスに接続した場合にのみ記録されます。',
      },
      record: {
        title: '記録、コミット、再生',
        noteStart: '',
        noteMid: ' に設定し、実際の API に対して一度実行し、その後',
        noteEnd:
          'に切り替えてコミットします。記録は git に保存されます — これが CI を決定論的にするものです。gitignore に追加しないでください。',
      },
    },
    guideLink: '詳しいセットアップガイド →',
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
