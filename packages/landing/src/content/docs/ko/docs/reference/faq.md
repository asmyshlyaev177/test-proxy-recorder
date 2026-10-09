---
title: FAQ
description: test-proxy-recorder에 대한 자주 묻는 질문 — 병렬 재생, 기록의 git 커밋, HAR 기록용 프록시 대상, Next.js 개발 서버, 기록 갱신.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
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

재생 실행이 실제 백엔드에 닿는 또 다른 경로는 세션 시간 초과입니다. 시간 초과는 `playwrightProxy.before()`를 호출할 때마다 다시 시작되며, 프록시를 거치는 요청으로는 다시 시작되지 않습니다. 다음 `before()` 호출 전에 시간 초과(기본값 120000 ms)가 다 되면 프록시는 `transparent`로 전환됩니다. 그러면 아직 실행 중인 테스트는 남은 요청을 실제 백엔드로 보냅니다. 테스트 하나가 그만큼 오래 걸릴 수 있다면 [CLI](/ko/docs/guides/cli/)의 `--timeout`이나 [설정](/ko/docs/guides/config/)의 `timeout`으로 시간 초과를 늘리세요.

## 병렬 워커로 기록할 수 있나요? {#parallel-recording}

아니요. 프록시는 한 번에 하나의 기록 세션만 유지합니다. 두 번째 테스트가 기록을 시작하면 프록시는 첫 번째 테스트의 파일을 저장하고 두 번째 테스트로 전환합니다. 그러면 프록시를 거치는 첫 번째 테스트의 나머지 요청은 두 번째 테스트의 `.mock.json`에 들어갑니다. `init`이 추가하는 `test:e2e:record` 스크립트처럼 워커 하나로 기록하세요.

```bash
npx playwright test --workers 1
```

재생은 병렬 워커로 실행할 수 있습니다. 각 테스트는 자신의 세션을 재생하며, `x-test-rcrd-id` 헤더로 서로 구분됩니다. `playwrightProxy.before()`가 페이지의 요청에 이 헤더를 설정하고, `registerProxyFetch()`가 서버 측 요청에 복사합니다. [예제 앱](/ko/docs/reference/examples/)이 `--workers 1`로 기록하는 것도 이 때문입니다.

## 기록을 git에 커밋해야 하나요?

네. CI가 네트워크 없이 재생할 수 있도록 기록은 git에 있어야 합니다. `e2e/recordings`를 `.gitignore`에 추가하지 **마세요**. 큰 기록 파일이 PR 리뷰를 어지럽히지 않게 하려면 `.gitattributes`에서 생성된 파일로 표시하세요. GitHub는 이런 파일의 diff를 기본적으로 접어 두지만 한 번 클릭하면 보여 주므로, API가 이름을 바꾼 필드가 리뷰에서 계속 보입니다. `binary`로 표시하면 그런 변경이 완전히 가려집니다.

```text
/e2e/recordings/** linguist-generated=true
```

## 프록시 `<target-url>`이 브라우저 전용(HAR) 기록에 중요합니까?

아니요. 브라우저 전용 기록에서는 대상이 무관합니다. 세션 관리를 위해 `/__control` 엔드포인트를 사용할 수 있도록 프록시 프로세스가 실행 중이기만 하면 됩니다. 대상은 서버 측(SSR) 요청도 프록시를 통과할 때만 중요합니다.

## `url` 패턴 밖의 브라우저 요청은 어떻게 되나요? {#outside-url}

Playwright가 가로채지 않으므로, 기록할 때든 재생할 때든 실제 네트워크로 나갑니다. 이런 요청은 아무것도 저장되지 않습니다. 프록시(`localhost:8100`)로 가는 요청은 예외입니다. `playwrightProxy.before()`는 이런 요청을 항상 프록시로 넘기며, 프록시가 직접 기록하고 재생합니다.

테스트가 네트워크에 나가지 않게 하려면 HAR이 해당 도메인을 포함하도록 `url`을 넓히거나, `page.route()`와 `route.abort()`로 그 도메인을 차단하세요.

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // HAR이 CDN도 기록하고 재생합니다.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // 분석 호출은 네트워크에 닿지 않고 실패합니다.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

자세한 내용은 [재생이 요청을 매칭하는 방식](/ko/docs/getting-started/how-it-works/#replay-matching)을 참조하세요.

## Next.js 개발 서버로 기록할 수 있나요?

기록과 재생에는 `next dev`보다 `next build` + `next start`를 선호하세요. 개발 서버는 느리고 시간 초과나 불안정한 기록을 유발할 수 있습니다.

## 기록을 어떻게 갱신하나요?

실제 API를 대상으로 기록 모드로 다시 실행하고(`RECORD_MODE=1`, 즉 `test:e2e:record` 스크립트), `e2e/recordings/`의 갱신된 파일을 커밋하세요.

## 재생 테스트에서 오류, 빈 목록, 느린 응답을 강제할 수 있나요? {#override-responses}

브라우저 요청이라면 가능합니다. Playwright는 라우트 핸들러를 [등록의 역순으로](https://playwright.dev/docs/api/class-route#route-fallback) 실행하므로, `playwrightProxy.before()` 다음에 추가한 `page.route()`가 각 요청을 먼저 봅니다. 이 핸들러는 요청에 직접 응답하거나, `route.fallback()`을 호출해 요청을 기록 쪽으로 넘길 수 있습니다.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // before() 다음에 추가했으므로 Playwright가 이 핸들러를 먼저 실행합니다.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // 그 밖의 모든 요청은 기록된 대로 재생됩니다
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

빈 목록이 필요하면 대신 `json: []`으로 응답하세요. 느린 응답이 필요하면 `route.fallback()`을 호출하기 전에 기다리세요. 예를 들어 `await new Promise((resolve) => setTimeout(resolve, 3000))`을 쓰면 됩니다. 그러면 기록된 응답이 3초 늦게 도착합니다.

서버 측 요청은 브라우저를 거치지 않으므로 `page.route()`로 바꿀 수 없습니다. 서버 측 요청은 `.mock.json`의 기록을 직접 수정하거나, 필요한 상태의 API를 대상으로 기록하세요. 파일에서 각 기록의 `response`에는 `statusCode`, `headers`, `body`가 들어 있습니다. 본문 길이를 바꾸면 `content-length` 헤더도 삭제하세요.

## 배포된 환경을 테스트하는 스위트에서도 쓸 수 있나요? {#deployed-environment}

브라우저 요청이라면 가능합니다. Playwright가 브라우저에서 요청을 가로채므로, 배포된 앱을 바꾸지 않고도 HAR이 요청을 기록하고 재생합니다. `url`이 브라우저가 호출하는 API 도메인을 가리키게 하세요. 그래도 프록시는 테스트 옆에서 실행되어야 합니다. `playwrightProxy.before()`가 프록시의 `/__control` 엔드포인트를 통해 각 테스트의 모드를 설정하기 때문입니다.

서버 측 요청은 앱 서버가 보내므로, CI의 프록시는 배포된 서버가 보내는 요청을 볼 수 없습니다. 이런 요청을 기록하거나 재생하려면 CI에서 프록시 옆에 앱 서버를 실행하세요. 테스트 실행용으로 앱을 빌드하고 시작할 때 API 기본 URL이 프록시를 가리키게 하고 `TEST_PROXY_RECORDER_ENABLED=true`를 설정하세요. [Next.js](/ko/docs/integrations/nextjs/)와 [TanStack Start](/ko/docs/integrations/tanstack-start/) 페이지에서 이 설정을 보여 줍니다.
