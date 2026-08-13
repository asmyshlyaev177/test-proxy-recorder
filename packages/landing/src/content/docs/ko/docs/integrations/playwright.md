---
title: Playwright
description: Playwright 테스트에서 test-proxy-recorder를 사용하는 방법 — before() 세션 훅, 권장되는 전역 티어다운, 그리고 기록 파일이 저장되는 위치.
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 1f1c2b10ddff1657ae98b71b6961c9311f30b52f
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

각 테스트 시작 시(또는 `beforeEach` / 페이지 픽스처에서) 호출하세요. 세션의 프록시 모드를 설정하고, `url`이 제공되면 브라우저 측 요청을 위한 HAR 기록을 설정합니다.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: HAR로 기록/재생할 브라우저 측 요청의 패턴.
  //
  // 프록시 URL이 아니라 실제 외부 API 도메인을 사용하세요.
  // 예시:
  //   /api\.example\.com/           — 내 API
  //   /x\.com/                      — 모든 x.com 브라우저 트래픽 기록(Chrome 확장 프로그램 테스트)
  //   /cognito-.*amazonaws\.com/    — 서드파티 인증
  url: /api\.example\.com/,
});
```

**`url` 패턴:** 브라우저가 호출하는 실제 외부 도메인과 일치합니다. 기록 모드에서는 요청이 실제 API로 가서 `.har` 파일에 저장됩니다. 재생 모드에서는 그 파일에서 제공되므로 네트워크가 필요 없습니다. 이 패턴은 프록시(`localhost:8100`)를 가리키지 **않습니다**.

**예외 — 풀스택 앱:** 프론트엔드가 프록시 URL을 API 기본값으로 사용해 브라우저도 `localhost:8100`을 호출하는 경우에는 `/localhost:8100/`을 패턴으로 사용하세요.

기록 파일 이름은 테스트 이름에서 파생됩니다(`"create a user"` → `create-a-user.mock.json` / `.har`).

## 전역 티어다운 (권장)

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

`teardown()`은 프록시를 `transparent`로 재설정하고 HAR [마스킹](/ko/docs/guides/secret-redaction/) 과정을 실행합니다. `fullyParallel`에서 테스트별 `afterAll` 훅에서 호출하지 마세요. 병렬 재생이 깨지는 이유는 [FAQ](/ko/docs/reference/faq/#parallel-replay)를 참조하세요.

## 기록 파일

```text
e2e/recordings/
  my-test.mock.json   # 서버 측(프록시) — SSR fetch
  my-test.har         # 클라이언트 측(HAR) — 브라우저 fetch
```
