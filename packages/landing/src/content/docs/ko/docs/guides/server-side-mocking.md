---
title: 'Playwright에서 서버 측 요청 모킹하기 (Next.js, TanStack Start)'
description: 'Next.js와 TanStack Start에서 page.route()가 서버 측 fetch를 놓치는 이유와, Playwright에서 테스트 모드, MSW, mockttp, 기록된 응답으로 이를 다루는 방법.'
sidebar:
  label: 서버 측 모킹
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: 6fd6662395c2237b6c951527806be5bd6116dec1
---

Next.js나 TanStack Start 앱에서는 서버가 페이지를 렌더링하는 동안 API를 호출합니다. Playwright의 요청 모킹은 이런 호출을 전혀 보지 못합니다. 아래에서는 그 이유를 설명한 다음, Playwright 테스트에서 이런 호출을 제어하는 네 가지 방법을 비교합니다. Next.js 테스트 모드, 서버 안의 MSW, mockttp 같은 포워드 프록시, 그리고 test-proxy-recorder로 실제 응답을 기록하는 방법입니다. 다른 도구에 관한 사실은 2026-10-03에 각 도구의 문서와 소스로 확인했습니다.

## `page.route()`가 서버 측 요청을 볼 수 없는 이유 {#why}

Playwright의 [`page.route()`](https://playwright.dev/docs/api/class-page#page-route)는 "페이지가 보내는 네트워크 요청"에 동작합니다. 반면 서버 컴포넌트, 라우트 로더, 서버 함수는 앱의 Node.js 프로세스에서 실행됩니다. 그 `fetch`는 이 프로세스에서 곧바로 API로 갑니다. 요청이 브라우저를 전혀 거치지 않으므로 Playwright가 가로챌 것이 없습니다. `page.route()`는 브라우저가 앱으로 보내는 페이지 요청과 돌아오는 HTML은 봅니다. 하지만 서버가 그 HTML을 만들려고 보낸 요청은 보지 못합니다.

HAR 파일도 같은 한계가 있습니다. [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har)는 "페이지에서 이루어지는 네트워크 요청"을 처리하기 때문입니다.

MSW의 [Playwright와의 비교](https://mswjs.io/docs/comparison#playwright)도 같은 이야기를 합니다. `page.route()`는 "Node.js 프로세스가 아니라, 실행된 브라우저 안의 트래픽"에 영향을 줍니다. Playwright 팀의 [서버 측 모킹에 관한 글](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)은 `page.route()`가 브라우저 요청에는 동작하지만 "서버 측 HTTP 호출에는 동작하지 않는다"고 말합니다. 내장 서버 측 모킹 기능 요청인 [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766)은 2026-05-22에 그 글의 링크와 함께 닫혔습니다.

## Next.js 테스트 모드 {#nextjs-test-mode}

Next.js는 `next/experimental/testmode/playwright`에 실험적인 Playwright 통합을 제공합니다. 문서는 [Next.js 저장소의 README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md)뿐이며, [Next.js Playwright 가이드](https://nextjs.org/docs/app/guides/testing/playwright)에는 언급이 없습니다. 테스트가 `next.onFetch()`로 핸들러를 등록하면, Next.js가 서버의 `fetch` 호출을 그 핸들러로 보냅니다.

```typescript
// README 예제를 줄인 것
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

필요한 것은 다음과 같습니다.

- `next.config.js`의 `experimental: { testProxy: true }`.
- `next/experimental/testmode/playwright`의 `defineConfig`로 만든 `playwright.config.ts`, 그리고 같은 모듈에서 `test`를 가져오는 테스트.

내부적으로는 Playwright 워커마다 작은 프록시 서버를 시작합니다. 픽스처는 페이지의 요청에 `Next-Test-Proxy-Port` 헤더(그 프록시)와 `Next-Test-Data` 헤더(테스트 id)를 추가합니다([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). `testProxy`가 켜져 있으면 서버는 이 헤더를 읽어 각 서버 측 `fetch`를 그 프록시로 보냅니다. 프록시는 요청을 해당 테스트의 핸들러에 넘깁니다([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). 핸들러는 테스트 id별로 보관되므로 병렬 테스트가 Next.js 서버 하나를 공유할 수 있습니다. 어떤 핸들러도 응답하지 않는 서버 fetch는 `Proxy request aborted`를 던집니다. 대신 핸들러가 `'continue'`를 반환하면 요청을 통과시킬 수 있습니다. `next.onFetch()`는 페이지 자체가 다른 오리진으로 보내는 `fetch` 호출도 받습니다.

현재 상태는 다음과 같습니다.

- 실험적 기능입니다. 가져오기 경로와 설정 키 모두 그렇게 표시하고 있으며, README 제목도 "Experimental test mode for Playwright"입니다.
- 수정은 여전히 이루어지고 있습니다. 가장 최근 수정인 [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525)는 2026-08-13에 병합되었습니다.
- README는 `next/experimental/testmode/playwright/msw`를 통한 테스트별 MSW 핸들러도 제공합니다. MSW 3.0(2026-09-28 출시)에서는 이 진입점을 불러오지 못합니다. MSW 3.0이 더 이상 의존하지 않는 `strict-event-emitter`를 가져오기 때문입니다. 또한 3.0에서 제거된 MSW의 `handleRequest()`를 호출합니다([MSW 3.0 릴리스 노트](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). MSW 2.15.0에서는 불러올 수 있습니다. 두 결과 모두 Next.js 16.3.8에서 2026-10-03에 확인했습니다.

## Next.js 서버 안의 MSW {#msw}

MSW는 `msw/node`의 `setupServer`로 Node.js에서 요청을 가로챕니다([Node.js 통합](https://mswjs.io/guides/integrations/node)). MSW 문서에는 Next.js 가이드가 없습니다. MSW 작성자는 App Router 이슈를 닫으면서 [mswjs/examples#101](https://github.com/mswjs/examples/pull/101)을 통합 참고 자료로 지목했습니다([댓글](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). 이 풀 리퀘스트는 2024-01-22부터 열려 있습니다. 이 예제는 고정된 핸들러 목록으로 루트 레이아웃에서 인터셉터를 시작합니다.

```tsx
// app/layout.tsx, mswjs/examples#101에서 가져옴
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

그러면 핸들러는 Next.js 프로세스 안에 있게 됩니다. 이 예제는 Playwright의 `webServer`로 그 프로세스를 시작하는데, `webServer`는 전체 실행에 프로세스 하나만 실행합니다([Playwright 팀의 글](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). 모든 워커가 그 하나의 서버로 페이지를 보내며, 병렬 워커는 그 핸들러의 동작에 다음과 같은 영향을 줍니다.

- 테스트는 자체 워커 프로세스에서 실행되므로 그 서버에서 `server.use()`를 호출할 수 없습니다. MSW에는 다른 프로세스의 핸들러를 바꾸는 API가 아직 출시되지 않았습니다. 그 제안인 [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617)의 `setupRemoteServer`는 2023-05-12부터 열려 있습니다. MSW의 Playwright 바인딩은 그 기능이 출시될 때까지 `page.route()`에 의존한다고 밝힙니다([`@msw/playwright`](https://github.com/mswjs/playwright)).
- `server.use()`를 호출하는 API 라우트처럼 자체 채널을 추가하면, 그 변경은 모든 테스트에 영향을 줍니다. [`server.use()`](https://mswjs.io/api/setup-server/use)로 추가한 핸들러는 "서버 인스턴스에 유지"됩니다. [server boundary 글](https://mswjs.io/blog/introducing-server-boundary)은 한 서버에서 동시에 적용한 오버라이드가 "모든 테스트가 공유하는 전역 상태"가 된다고 설명합니다. #1617에서 MSW 작성자는 실제로는 "고정된 핸들러 목록"을 유지하거나 "테스트 케이스마다 앱 인스턴스"를 시작하게 된다고 말합니다.

실제로는 공유된 Next.js 서버 안의 MSW가 모든 병렬 테스트에 같은 응답을 줍니다. MSW 위에 테스트별 핸들러를 더하는 도구가 두 가지 있습니다. Next.js 테스트 모드는 MSW 핸들러를 받습니다(MSW 2 사용 시, 위 참조). [scenarist](https://github.com/citypaul/scenarist)는 서버 코드가 각 `fetch`에 전달하는 `x-scenarist-test-id` 헤더로 시나리오를 구분합니다([Next.js 어댑터](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## mockttp 같은 포워드 프록시 {#mockttp}

Playwright 팀은 #30766을 닫으면서 Simon Knott의 [글](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)을 [안내했습니다](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681). 이 글은 HTTP·HTTPS 목 서버이자 프록시인 [mockttp](https://github.com/httptoolkit/mockttp)를 서버의 나가는 트래픽 앞에 둡니다. 각 테스트는 `mocks.forPost(url).thenJson(200, body)` 같은 규칙을 mockttp에 추가합니다.

앱 코드는 바뀌지 않습니다. 앱의 서버 프로세스는 나가는 요청을 프록시로 보내는 환경 변수와 함께 시작됩니다.

- 프록시 URL로 설정한 `HTTP_PROXY`와 `HTTPS_PROXY`.
- Node의 내장 `fetch`가 이 변수를 쓰게 하는 `NODE_USE_ENV_PROXY=1`. Node.js는 이 변수를 24.0.0과 22.21.0에 추가했으며, 활발한 개발(Active development) 단계로 표시합니다([Node.js 문서](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- 프록시의 CA 인증서를 가리키는 `NODE_EXTRA_CA_CERTS`. 서버가 mockttp가 HTTPS 호스트용으로 생성하는 인증서를 신뢰하게 합니다.

프록시는 Playwright 워커 하나에 속하므로, 이 글은 워커 픽스처에서 워커마다 앱 서버를 하나씩, 각각 비어 있는 포트에 시작합니다. 어떤 워커도 생기기 전에 전체 실행용 프로세스 하나를 시작하는 Playwright의 `webServer`는 쓰지 않습니다. 이 글의 설정에서는 규칙이 없는 요청이 실제 API로 그대로 전달됩니다. 이 글은 빠뜨린 목이 드러나도록 대신 오류로 응답하라고 제안합니다.

Playwright 팀은 이 방식을 "서버 언어와 프레임워크에 구애받지 않는다"고 설명합니다. 글 자체는 Next.js나 TanStack Start가 아니라 일반 Node 서버를 사용합니다.

## test-proxy-recorder로 실제 응답 기록하기 {#test-proxy-recorder}

위의 세 가지 방법에서는 모든 응답을 직접 작성합니다. test-proxy-recorder는 로컬 실행 중에 실제 API가 반환하는 응답을 기록한 다음 CI에서 재생합니다.

- **프록시.** 테스트 실행 동안 앱 옆에서 `test-proxy-recorder <target-url>`을 시작하세요. `TEST_PROXY_RECORDER_ENABLED`가 설정되어 있는 동안 앱의 API 기본 URL이 프록시를 가리키게 하세요. 각 프록시는 시작할 때 지정한 `<target-url>`, 즉 백엔드 하나로 전달합니다.
- **`registerProxyFetch()`.** 서버에서 한 번 호출하면 전역 `fetch`를 패치합니다. 현재 요청의 `x-test-rcrd-id` 헤더를 나가는 모든 요청에 복사합니다. 프록시는 이 헤더를 읽어 각 서버 측 호출을 해당 테스트 아래에 분류합니다. `TEST_PROXY_RECORDER_ENABLED`가 설정되지 않으면 프로덕션에서 이 호출은 아무 동작도 하지 않습니다.
- **테스트별 id.** `playwrightProxy.before(page, testInfo, mode)`는 스펙 파일, 그 안의 `describe` 제목, 테스트 제목으로 세션 id를 만듭니다. 이 id를 페이지의 요청에 `x-test-rcrd-id`로 보내고, 그 세션을 `record` 또는 `replay`로 전환합니다. 병렬 워커가 앱 서버 하나와 프록시 하나를 공유해도 각 테스트는 자신만의 기록을 갖습니다.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

실제 API를 대상으로 한 번 기록하고 `.mock.json`(서버)과 `.har`(브라우저) 파일을 커밋하세요. 그러면 CI가 백엔드를 끈 상태로 이 파일들을 재생합니다. 재생 중에 기록이 없는 요청은 그 요청을 명시한 404를 받으며, API에는 절대 도달하지 않습니다.

기록된 응답은 기록하는 동안 API가 한 일만 담습니다. 필요할 때 API에서 바로 받아 낼 수 없는 오류나 엣지 케이스를 강제하려면, 위 방법 중 하나로 핸들러를 직접 작성하는 편이 더 간단합니다.

설정 방법은 [Next.js](/ko/docs/integrations/nextjs/)와 [TanStack Start](/ko/docs/integrations/tanstack-start/) 가이드에 있습니다.

## 방법 비교 {#comparison}

| 방법 | 앱 설정 | 병렬 테스트 | 핸들러 또는 기록된 응답 | Next.js와 TanStack Start |
| --- | --- | --- | --- | --- |
| [Next.js 테스트 모드](#nextjs-test-mode) | `next.config.js`의 `experimental.testProxy` | 예, 핸들러를 테스트별로 보관 | 핸들러(`next.onFetch()` 또는 MSW 2 핸들러) | Next.js만 |
| [서버 안의 MSW](#msw) | 서버 코드에서 시작한 `setupServer`(MSW 예제에서는 루트 레이아웃) | 그 서버의 모든 테스트에 핸들러 세트 하나 | 핸들러 | Next.js: 열려 있는 풀 리퀘스트의 예제. TanStack Start: 문서화되지 않음 |
| [mockttp](#mockttp) | 코드 변경 없음. 서버 프로세스에 프록시 변수와 CA 인증서 | 예, 워커마다 앱 서버 하나로 | 핸들러. 규칙이 없는 요청은 그대로 통과 | 문서화되지 않음. Playwright 팀은 프레임워크에 구애받지 않는다고 설명 |
| [test-proxy-recorder](#test-proxy-recorder) | 테스트 중 프록시를 가리키는 API 기본 URL, 그리고 `registerProxyFetch()` | 예, 공유 앱 서버 하나로 | 실제 API에서 기록 | 둘 다 문서화됨 |

[비교](/ko/docs/reference/comparison/) 페이지는 Mocky Balboa, scenarist, Polly.js, talkback, proxay를 포함한 더 많은 도구와 브라우저 측 옵션을 다룹니다.
