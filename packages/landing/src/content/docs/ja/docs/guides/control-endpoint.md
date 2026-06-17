---
title: コントロールエンドポイント
description: プロキシは /__control を公開し、transparent・record・replay のモードをプログラムから切り替えられます。
---

プロキシはプログラムからモードを切り替えるために `/__control` を公開しています。

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode: 'transparent' | 'record' | 'replay';
  id?: string;       // required for record/replay
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
}
```

ほとんどのセットアップでは、これを直接呼ぶことはありません — `playwrightProxy.before()` と `setProxyMode()`（[API リファレンス](/docs/reference/api/readme/)参照）が代わりに POST します。シェル、CI のステップ、AI エージェントからプロキシを操作するときに `/__control` を使ってください。
