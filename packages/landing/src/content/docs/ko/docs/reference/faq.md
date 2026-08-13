---
title: FAQ
description: test-proxy-recorder에 대한 자주 묻는 질문 — 병렬 재생, 기록의 git 커밋, HAR 기록용 프록시 대상, Next.js 개발 서버, 기록 갱신.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 35d6fcf35338b9b64fd4c7988beea62f0a7219d3
---

## 병렬 재생 테스트가 가끔 실제 백엔드를 호출합니다. 왜 그런가요? {#parallel-replay}

아마도 테스트별 훅에서 `playwrightProxy.teardown()`을 호출하고 있을 것입니다. 이것은 **전역** 프록시 모드를 `transparent`로 설정하며, `fullyParallel: true`에서는 각 Playwright 워커가 자체 `test.afterAll`을 실행합니다. 빠른 테스트가 끝나서 `teardown()`을 호출하는 동안 느린 테스트가 계속 실행 중이라면, 프록시가 테스트 도중에 transparent로 전환되어 나머지 요청이 재생되는 대신 실제 백엔드로 전달됩니다.

```typescript
// ❌ 병렬 재생을 깨뜨림 — teardown()은 모든 세션에 전역으로 영향을 줌
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**해결책:** `test.afterAll`을 제거하세요. 세션 정리는 `context.on('close')` → `cleanupSession()`으로 자동으로 이루어집니다. [전역 티어다운](https://playwright.dev/docs/test-global-setup-teardown)은 전체 실행 후 프록시를 재설정해야 할 때만 사용하세요.

## 기록을 git에 커밋해야 하나요?

네. CI가 네트워크 없이 재생할 수 있도록 기록은 git에 있어야 합니다. `e2e/recordings`를 `.gitignore`에 추가하지 **마세요**. 큰 기록 파일이 PR diff를 비대하게 만드는 것을 막으려면 `.gitattributes`에서 바이너리로 표시하세요.

```text
/e2e/recordings/** binary
```

## 프록시 `<target-url>`이 브라우저 전용(HAR) 기록에 중요합니까?

아니요. 브라우저 전용 기록에서는 대상이 무관합니다. 세션 관리를 위해 `/__control` 엔드포인트를 사용할 수 있도록 프록시 프로세스가 실행 중이기만 하면 됩니다. 대상은 서버 측(SSR) 요청도 프록시를 통과할 때만 중요합니다.

## Next.js 개발 서버로 기록할 수 있나요?

기록과 재생에는 `next dev`보다 `next build` + `next start`를 선호하세요. 개발 서버는 느리고 시간 초과나 불안정한 기록을 유발할 수 있습니다.

## 기록을 어떻게 갱신하나요?

실제 API를 대상으로 기록 모드로 다시 실행하고(픽스처에서 `MODE = 'record'`로 설정하거나 `RECORD_MODE=1`), 다시 재생으로 전환한 뒤 `e2e/recordings/`의 갱신된 파일을 커밋하세요.
