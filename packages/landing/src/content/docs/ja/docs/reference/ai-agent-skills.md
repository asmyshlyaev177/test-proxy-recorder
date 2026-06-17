---
title: AI エージェントスキル
description: test-proxy-recorder のスキルをインストールすると、AI コーディングエージェント（Claude Code、Cursor、Copilot）が正しいセットアップコードを生成します。
---

AI コーディングエージェント（Claude Code、Cursor、Copilot など）を使っているなら、このライブラリのスキルをインストールして、エージェントが正しいセットアップコードを生成できるようにしてください:

```bash
npx @tanstack/intent@latest install
```

これにより `test-proxy-recorder` のスキルがプロジェクトに追加されます。エージェントは、正しいプロキシ/フィクスチャのセットアップ、record と replay のワークフロー、Next.js の SSR ヘッダーパターンを、ガイドなしで把握できるようになります。

## スキルの保守（コントリビューター向け）

エージェントのスキルは [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills) にあります。定期的に — そしてライブラリの API やサンプルが変わるたびに — 確認してください:

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` は必ずパスする必要があります。`stale` は参考情報です — リリース後にドリフトを報告したら、該当スキルの内容を再確認してください（そして `library_version` を上げてください）。
