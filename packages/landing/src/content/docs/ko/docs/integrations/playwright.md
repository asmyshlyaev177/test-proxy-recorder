---
title: 'Playwright 설정: 테스트마다 기록하고 재생하기'
description: test-proxy-recorder로 Playwright 테스트의 API 호출을 기록하고 재생합니다. before() 세션 훅, 권장되는 전역 티어다운, 테스트별 기록 파일을 사용합니다.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 41506a06c67c43287c172907f5ef6c6ef07e36e3
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

**예외 — 풀스택 앱:** 프론트엔드가 프록시 URL을 API 기본값으로 사용해 브라우저도 `localhost:8100`을 호출하는 경우에는 `/localhost:8100/`을 패턴으로 사용하세요. 그러면 이 브라우저 요청은 프록시로 전달되고, 프록시가 테스트의 `.mock.json`에 기록하고 그 파일에서 재생합니다. 따라서 기록이 없는 요청은 HAR 중단이 아니라 프록시의 404를 받습니다([재생이 요청을 매칭하는 방식](/ko/docs/getting-started/how-it-works/#replay-matching) 참조).

기록 파일 이름은 테스트 파일, `describe` 제목, 테스트 제목에서 만들어집니다(`users.spec.ts` › `create a user` → `users__create-a-user.mock.json` / `.har`). 120바이트를 넘는 이름은 잘리고 끝에 해시가 붙습니다.

## 기록이 없는 테스트

재생 모드에서 테스트에 기록이 없으면 `before()`는 프록시를 전환하기 전에 예외를 던집니다.

```text
[test-proxy-recorder] This test has no recording: <recordingsDir>/users__create-a-user.mock.json does not exist. Record this test first.
```

테스트를 건너뛰지 말고 기록하세요. 건너뛴 테스트는 실패가 아니라 건너뜀으로 보고되므로, 기록이 없다는 사실이 눈에 띄지 않습니다. `hasRecording(testInfo)`는 재생과 같은 파일 이름을 사용해, 예외를 던지지 않고 같은 질문에 답합니다.

## 전역 티어다운 (권장) {#global-teardown-recommended}

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

`teardown()`은 프록시를 `transparent`로 재설정하고 HAR [마스킹](/ko/docs/guides/secret-redaction/) 과정을 실행합니다. `transparent`로 전환하면 모든 기록 세션이 저장되고 끝납니다. `fullyParallel`에서 테스트별 `afterAll` 훅에서 호출하지 마세요. 병렬 재생과 기록이 깨지는 이유는 [FAQ](/ko/docs/reference/faq/#parallel-replay)를 참조하세요.

## 기록 파일

```text
e2e/recordings/
  my-test.mock.json   # 서버 측(프록시) — SSR fetch
  my-test.har         # 클라이언트 측(HAR) — 브라우저 fetch
```
