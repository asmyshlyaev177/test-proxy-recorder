---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js, Next.js 테스트 모드'
description: 'test-proxy-recorder를 MSW, routeFromHAR, Polly.js, Next.js 테스트 모드, mockttp, Mocky Balboa, scenarist, talkback, proxay와 출처를 들어 비교합니다.'
sidebar:
  label: 비교
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

여기 나오는 도구는 모두 엔드투엔드 테스트가 받는 API 응답을 제어합니다. 차이는 요청을 어디서 가로채는지(브라우저 안, 서버 안, 또는 별도의 프록시)와, 응답을 직접 작성하는지 기록하는지에 있습니다. 표는 [문서 개요](/ko/docs/#comparison)의 여섯 가지 도구를 그대로 두고 Next.js 테스트 모드, mockttp, scenarist, talkback, proxay를 더했습니다. 모든 칸은 2026-10-03 기준으로 각 도구의 문서, README, 소스에서 가져왔으며, 출처는 표 아래에 링크했습니다. "문서화되지 않음"은 그 출처에 언급이 없다는 뜻입니다.

## 기능 표 {#table}

| 도구 | 실제 트래픽 기록 | 서버 측(SSR) | 브라우저 측 | WebSocket | Playwright 네이티브 | 최신 릴리스 |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | 예 | 예, 프록시를 통해 | 예, HAR을 통해 | 예 | 예 | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | 예 | 아니요 | 예 | 아니요 | 내장 | Playwright 1.63.0, 2026-09-04 |
| MSW | 아니요(핸들러, 또는 `@msw/source`를 통한 HAR) | 서버 프로세스 안에서 | 예 | 예 | `@msw/playwright`, 브라우저 요청 | 3.0.2, 2026-10-03 |
| Polly.js | 예 | 서버 프로세스 안에서 | 예 | 문서화되지 않음 | 서드파티 어댑터 | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | 예 | 아니요 | 예 | 문서화되지 않음 | 예 | 0.3.0, 2026-05-12 |
| Mocky Balboa | 아니요(핸들러) | 예 | 예 | 문서화되지 않음 | 예 | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Next.js 테스트 모드 | 아니요(핸들러) | 예, Next.js만 | 다른 오리진으로 가는 요청 | 문서화되지 않음 | 예 | 실험적, Next.js 16.3.8에 포함, 2026-09-30 |
| mockttp | 문서화되지 않음 | 예, 포워드 프록시로 | 예, 브라우저의 프록시로 | 예 | 아니요, 픽스처를 직접 작성 | 4.6.3, 2026-09-11 |
| scenarist | 아니요(코드로 작성한 시나리오) | Next.js와 Express | 아니요 | 문서화되지 않음 | 예 | 0.5.1, 2026-09-27 |
| talkback | 예 | 예, API 주소로 지정해서 | 문서화되지 않음 | 문서화되지 않음 | 아니요 | 4.2.0, 2024-07-10 |
| proxay | 예 | 예, API 주소로 지정해서 | 예, API 주소로 지정해서 | 문서화되지 않음 | 아니요 | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## 출처와 참고 {#sources}

릴리스 날짜는 GitHub 릴리스가 링크되어 있지 않으면 npm 레지스트리에서 가져왔습니다.

- **test-proxy-recorder.** 서버 측 호출은 프록시를, 브라우저 호출은 HAR을 거칩니다([작동 원리](/ko/docs/getting-started/how-it-works/)). 기록된 WebSocket 메시지는 프록시가 재생합니다([CLI](/ko/docs/guides/cli/#websocket-replay-pacing)). 릴리스: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** `update: true`이면 실제 트래픽으로 HAR을 기록합니다([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). 재생은 "페이지에서 이루어지는 네트워크 요청"을 처리합니다([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). HTTP 요청에 응답하는 `route()` 핸들러를 거치며, WebSocket 경로는 없습니다([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). 릴리스: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** 요청 핸들러를 직접 작성합니다. MSW 자체는 아무것도 기록하지 않지만, [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har)는 브라우저 DevTools에서 내보낸 HAR 파일로 핸들러를 생성할 수 있습니다. Node.js에서는 요청을 보내는 프로세스 안에서 실행됩니다([`setupServer`](https://mswjs.io/guides/integrations/node)). WebSocket은 [`ws` API](https://mswjs.io/docs/websocket)를 사용합니다. 공식 [`@msw/playwright`](https://github.com/mswjs/playwright) 바인딩은 `page.route()`를 거치므로 브라우저 요청을 다룹니다. 릴리스: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** [저장소](https://github.com/Netflix/pollyjs)는 Polly.js를 "Record, Replay, and Stub HTTP Interactions"(HTTP 상호작용의 기록, 재생, 스텁)라고 소개합니다. [node-http 어댑터](https://netflix.github.io/pollyjs/#/adapters/node-http)는 Node의 `http`와 `https` 모듈을 패치하고, [fetch 어댑터](https://netflix.github.io/pollyjs/#/adapters/fetch)는 전역 `fetch`를 감쌉니다. 따라서 Polly는 자신을 실행하는 프로세스 안에서 기록합니다. 문서의 어댑터 목록에는 WebSocket 어댑터가 없습니다. Playwright 지원은 서드파티 [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright)가 담당하며, [Polly 문서](https://netflix.github.io/pollyjs/#/adapters/playwright)가 이를 링크합니다. 릴리스: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** [README](https://github.com/vitalets/playwright-network-cache)에 따르면 "네트워크 요청을 파일 시스템에 캐싱해" Playwright 테스트 속도를 높입니다. `CacheRoute`는 `page.route()`로 가로채므로([소스](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)) 브라우저 요청만 봅니다. 릴리스: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** 서버와 클라이언트 요청 모두에 대한 목을 하나의 API로 테스트 안에서 정의합니다. 테스트가 병렬로 실행되는 동안에도 목은 테스트별로 격리됩니다([기능](https://docs.mockybalboa.com/docs/features/)). Next.js 14 이상에서는 Mocky Balboa의 CLI가 Next.js 서버를 시작합니다([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). 문서에서 WebSocket은 서버와 테스트 러너 사이의 채널로만 언급됩니다. 릴리스: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Next.js 테스트 모드.** `next.onFetch()`로 등록한 핸들러는 서버의 `fetch` 호출과, 페이지가 다른 오리진으로 보내는 `fetch` 호출을 받습니다([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). 설정, 현재 상태, MSW 3 관련 내용은 [서버 측 모킹](/ko/docs/guides/server-side-mocking/#nextjs-test-mode)에서 다룹니다. 릴리스: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** "node나 브라우저에서" 실행되는 테스트를 위한 HTTP·HTTPS 목 서버이자 프록시입니다([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()`은 WebSocket 연결을 모킹합니다([소스](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). README에는 기록 모드에 대한 설명이 없습니다. 작성해야 할 픽스처는 Playwright 팀의 [글](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)에 나와 있습니다. 릴리스: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** [README](https://github.com/citypaul/scenarist)는 scenarist를 "런타임 시나리오 관리와 테스트 ID 격리를 갖춘, MSW 기반" 도구로 설명하며, 시나리오는 코드로 작성합니다. FAQ에서는 "Playwright의 클라이언트 측 모킹을 보완하는 서버 측 시나리오 관리를 제공한다"고 말합니다. 서버 코드가 각 `fetch`에 `x-scenarist-test-id`를 전달하고([Next.js 어댑터](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), `@scenarist/playwright-helpers`가 Playwright 픽스처를 제공합니다. 릴리스: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** "HTTP 요청을 기록하고 재생하는 JavaScript HTTP 프록시"입니다([README](https://github.com/ijpiantanida/talkback)). 앱은 요청을 talkback으로 보냅니다. 저장된 테이프와 일치하는 요청은 그 테이프의 응답을 받고, 알 수 없는 요청은 호스트로 전달된 뒤 새 테이프로 저장됩니다. README에는 브라우저나 테스트별 테이프에 대한 언급이 없습니다. 릴리스: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** "웹 프론트엔드와 그 백엔드" 또는 "서버와 다른 서버" 사이에 쓰는 기록·재생 프록시입니다([README](https://github.com/airtasker/proxay)). 테스트는 예를 들어 `beforeEach`에서 `POST /__proxay/tape`로 테이프를 고르며, README는 병렬 테스트를 다루지 않습니다. 2.0.0 버전은 [GitHub 릴리스](https://github.com/airtasker/proxay/releases/tag/v2.0.0)이며, [npm](https://www.npmjs.com/package/proxay)은 여전히 1.9.0을 제공합니다.

## Playwright용 Polly.js 대안 {#pollyjs}

Netflix의 Polly.js는 HTTP를 기록하고 재생하며 스텁으로 대체할 수 있고, test-proxy-recorder에 영감을 주었습니다. 2026-10-03 기준 상태는 다음과 같습니다.

- `@pollyjs/core`는 2023-07-20의 6.0.6 이후 릴리스가 없습니다. 저장소의 마지막 변경은 2025-05-31에 `@pollyjs/adapter-fetch` 6.0.7을 배포한 것으로, Node에서 fetch 어댑터의 지원 중단(deprecation) 표시를 해제했습니다([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Polly에는 자체 Playwright 어댑터가 없습니다. 문서는 브라우저 컨텍스트나 페이지에 연결되는 서드파티 [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright)를 안내합니다. 이 어댑터의 마지막 릴리스는 2024-04-18의 2.4.0입니다.
- 서버 측 호출을 다루려면 Polly가 node-http 또는 fetch 어댑터를 통해 서버 프로세스 안에서 실행되어야 합니다.

Polly.js에서 옮겨 온다면, Polly.js의 개념은 test-proxy-recorder에 다음과 같이 대응합니다.

| Polly.js | test-proxy-recorder |
| --- | --- |
| `record`, `replay`, `passthrough` 모드([설정](https://netflix.github.io/pollyjs/#/configuration)) | `playwrightProxy.before()`가 테스트별로 설정하는 `record`, `replay`, `transparent` 모드 |
| Polly 인스턴스마다 이름이 붙은 기록 하나, persister가 저장 | 기록 디렉터리에 Playwright 테스트마다 `.mock.json`(서버) 하나와 `.har`(브라우저) 하나 |
| 요청을 보내는 프로세스 안의 어댑터 | 서버 호출에는 프록시 프로세스, 브라우저 호출에는 HAR, 서버에는 `registerProxyFetch()` |
| 기본적으로 메서드, 헤더, 본문, 순서, URL로 요청을 매칭 | 서버 측 요청은 메서드, 경로, 쿼리 해시로 기록된 순서대로 매칭하며 본문은 비교하지 않음. 브라우저 요청은 POST 본문도 비교하는 Playwright의 HAR 규칙을 따름 |

## Next.js와 Playwright에서의 MSW {#msw}

Next.js 앱에서는 브라우저 요청과 서버 요청에 서로 다른 MSW 설정이 필요합니다.

- **브라우저 요청.** 공식 바인딩인 [`@msw/playwright`](https://github.com/mswjs/playwright)는 테스트별로 바꿀 수 있는 `network` 픽스처와 함께, `page.route()`를 통해 핸들러를 실행합니다.
- **서버 요청.** MSW는 Next.js 프로세스 안에서 실행됩니다. MSW 문서에는 Next.js 가이드가 없고, 참고 예제는 열려 있는 풀 리퀘스트인 [mswjs/examples#101](https://github.com/mswjs/examples/pull/101)입니다. 런타임에 바꾼 핸들러는 그 서버에 닿는 모든 테스트가 공유합니다. 자세한 내용과 출처는 [서버 측 모킹](/ko/docs/guides/server-side-mocking/#msw)에 있습니다.
- **테스트별 서버 핸들러.** Next.js 테스트 모드는 테스트별로 MSW 핸들러를 받지만, 그 MSW 진입점은 MSW 3.0에서 불러오지 못합니다([자세히](/ko/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist는 Next.js와 Express용으로 MSW 위에 테스트별 시나리오를 구성하며, 서버 코드가 각 `fetch`에 테스트 id 헤더를 전달합니다.
- **기록.** MSW는 트래픽을 기록하지 않습니다. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har)는 브라우저 DevTools에서 내보낸 HAR 파일을 핸들러로 바꿉니다.

test-proxy-recorder는 반대쪽을 택합니다. 실제 API에서 서버와 브라우저 양쪽을 모두 기록하므로 작성할 핸들러가 없습니다. 그 대신 필요할 때 API에서 바로 받아 낼 수 없는 응답은 제어하기가 더 어렵습니다.

## 다른 도구를 선택해야 하는 경우 {#when-to-use-something-else}

- **모든 트래픽이 브라우저 측인 경우.** Playwright에 내장된 `routeFromHAR`는 추가 의존성이 필요 없습니다. 여기서 시작하고, 서버 측 요청이 생기면 test-proxy-recorder를 추가하세요.
- **응답을 직접 작성하거나 오류와 엣지 케이스를 강제하고 싶은 경우.** MSW의 핸들러가 더 잘 맞으며, MSW는 Playwright뿐 아니라 [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook), [브라우저](https://mswjs.io/guides/integrations/browser)에서도 실행됩니다. Playwright에서 테스트별 서버 측 핸들러가 필요하면 Mocky Balboa, scenarist, Next.js 테스트 모드를 살펴보세요.
- **설정 부담이 적은 브라우저 측 캐싱만 필요한 경우.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache)는 픽스처 하나로 응답을 디스크에 캐싱합니다.
- **서버가 JavaScript로 작성되지 않았거나 서버 코드를 바꿀 수 없는 경우.** mockttp 같은 포워드 프록시는 `HTTPS_PROXY`로 동작합니다. Playwright 팀의 [글](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo)에 따르면 Python, Go, Ruby, Rust, .NET도 같은 방식으로 동작하며, Java에는 `-Dhttps.proxyHost`와 `-Dhttps.proxyPort`가 필요합니다.
- **어떤 언어에서든 Playwright 밖에서 기록과 재생이 필요한 경우.** proxay와 talkback은 기록을 테이프 파일로 저장하는 독립형 HTTP 서버입니다.
