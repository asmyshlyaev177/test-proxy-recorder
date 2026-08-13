---
title: 설정 파일
description: CLI 플래그 대신 자동으로 검색되는 설정 파일에 test-proxy-recorder 옵션(대상, 포트, 마스킹 정규식, WebSocket 페이싱)을 넣으세요.
i18nSource: docs/guides/config.md
i18nSourceBlob: d633335aa6541254ec9f1af34ca98d1ee4b6d758
---

플래그 몇 개를 넘어서는 경우, 특히 본문 마스킹 정규식이 있다면 옵션을 설정 파일에 넣으세요. 프록시는 현재 디렉터리에서 `test-proxy-recorder.config.{ts,js,mjs,cjs}`를 자동으로 검색하며, 명시적으로 지정하려면 `--config <path>`를 전달하면 됩니다. `.ts` 파일은 별도 설정 없이 동작합니다.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // 마스킹은 기본적으로 활성화되어 있으며, 이 객체로 커스터마이즈합니다(비활성화하려면 `redaction: false` 사용).
  redaction: {
    headers: ['x-api-key'],         // 추가 헤더 — 기본값과 병합됨
    bodyPatterns: [/sk_live_\w+/g], // 실제 RegExp 리터럴 — CLI 이스케이프 불필요
    allowCookies: ['theme'],        // 이 쿠키는 마스킹하지 않음
  },
  websocket: {
    timing: 'burst',                // 'burst'(기본값) 또는 'original'(재페이싱)
  },
});
```

```bash
test-proxy-recorder                 # 모든 옵션을 설정 파일에서 가져옴
test-proxy-recorder --port 9000     # 설정 파일을 사용하되 CLI의 포트가 우선
```

## 우선순위

모든 옵션은 **CLI 플래그 → 설정 파일 → 내장 기본값** 순서로 결정됩니다. 명령줄에서 전달한 플래그는 항상 설정 파일을 덮어쓰며, 생략한 항목은 설정 파일, 그다음 기본값으로 폴백합니다. (`--redact-headers` 같은 목록 플래그는 설정의 목록을 병합하지 않고 *대체*합니다. 덮어쓰고 싶을 때만 전달하세요.) `target`은 CLI 인자나 설정의 `target`으로 지정할 수 있으며, 둘 다 있으면 인자가 우선합니다.

전체 `Config` 타입은 [API 참조](/ko/docs/reference/api/interfaces/config/)를 참조하세요.
