---
title: シークレットのマスキング
description: マスキング（redaction）はデフォルトで有効 — Authorization、Cookie、Set-Cookie はディスクに書き込まれる前に記録から取り除かれます。ヘッダーやボディのパターン追加、Cookie の許可、プログラムからのマスキングが可能です。
i18nSource: docs/guides/secret-redaction.md
i18nSourceBlob: 1b03e54f96e418edf62ea8dd611fcc2fc4f30bbc
---

記録は git にコミットされるため、シークレットはディスクへ何かを書き込む前に取り除かれます。マスキングは**デフォルトで有効**です。プロキシは次のリクエスト/レスポンスヘッダーの値を `[REDACTED]` に置き換えます:

- `Authorization`
- `Cookie`
- `Set-Cookie`

これは安全です: 再生時のマッチングはこれらのヘッダーを無視するため、マスキングが再生を壊すことはありません。`.mock.json` の記録、WebSocket の記録、`.har` ファイルに適用されます。マスキングを無効にするには、CLI で `--no-redact` を渡すか、[設定](/ja/docs/guides/config/)で `redaction: false` を設定します。

*一部*の Cookie だけが機微な場合は、無害なものを名前で許可します（例: `theme` や A/B テストの Cookie）。許可された Cookie は `Cookie`/`Set-Cookie` 内で値を保持し、それ以外の Cookie は引き続きマスキングされます。

:::note[`.har` ファイルのマスキング方法]
`.har` ファイルはプロキシではなく Playwright の `routeFromHAR` が書き込むため、別パスでマスキングされます。`playwrightProxy.teardown()` は、プロキシと**同じマスキング設定**（ヘッダー、`allowCookies`、`bodyPatterns` がすべて、ヘッダーとパース済みの `cookies` 配列の両方に適用）を使って、記録ディレクトリ内のすべての `.har` を書き換えます。これは Playwright の **`globalTeardown`** から実行されます — したがって HAR のマスキングには `playwrightProxy.teardown()` を呼ぶ `globalTeardown`（`init` が生成する[推奨セットアップ](/ja/docs/integrations/playwright/#global-teardown-recommended)）が必要です。

これはテストごとには実行できません: Playwright はコンテキストが閉じるときに HAR をフラッシュしますが、クローズハンドラーを待たないため、そこでマスキングするとプロセス終了と競合してファイルが切り詰められることがあります。teardown は `/__control` から設定を取得し（プロキシは実行中である必要があります。到達不能なら組み込みのヘッダーデフォルトが適用されます）、実際に変更したファイルのみ書き換え、base64 のレスポンスボディはそのまま残します。多層防御として、なお短命のテスト用クレデンシャルで記録し、コミット前に HAR を確認してください — 下記の推奨認証パターンを参照。
:::

## 推奨される認証パターン

ログインフローとクレデンシャルを記録から完全に排除するには、プロキシを `transparent` モードにした Playwright の **setup project** で認証を実行し、`storageState` を **gitignore された** `auth-state.json` に保存して、テストで再利用してください。記録されるリクエストには（マスキング済みの）セッションヘッダーのみが含まれ、ログインは含まれません。

実際の認証プロバイダーに対する動作するセットアップは[認証済みアプリの例](/ja/docs/reference/examples/#authenticated-app)を参照してください。

## マスキング対象を調整する

デフォルトのヘッダーは（マスキングが有効な間）常に適用されます。それに追加できます。

### CLI フラグ

- `--no-redact` — シークレットのマスキングを無効化（デフォルトで有効）。
- `--redact` — シークレットのマスキングを有効化。設定が `redaction: false` の場合に再有効化するためにのみ必要です。
- `--redact-headers <names>` — 追加でマスキングするヘッダー名（カンマ区切り、デフォルトとマージ）。
- `--redact-body <patterns>` — リクエスト/レスポンスのボディからマスキングする正規表現パターン（カンマ区切り）。
- `--allow-headers <names>` — マスキングから除外するヘッダー名（カンマ区切り、例: `set-cookie`）。
- `--allow-cookies <names>` — `Cookie`/`Set-Cookie` 内でマスキングせず保持する Cookie 名（カンマ区切り）。

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### プログラムから

`ProxyServer` を直接構築する場合:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

既存の記録を自分でマスキングしたい場合は、`redactSession(session, config)` もエクスポートされています。
