---
title: '기록과 재생의 작동 원리: SSR에는 프록시, 브라우저에는 HAR'
description: test-proxy-recorder는 서버 측 요청을 위한 프록시와 브라우저 측 요청을 위한 HAR, 두 가지 메커니즘으로 트래픽을 기록하며, 둘을 함께 쓰거나 각각 따로 쓸 수 있습니다.
sidebar:
  label: 작동 원리
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 26b907ff9c82df698a55827441e0b4b432a42262
---

test-proxy-recorder는 요청이 발생하는 위치에 따라 두 가지 기록 메커니즘을 지원합니다. 둘은 함께 또는 독립적으로 사용할 수 있습니다.

| 메커니즘 | 기록 대상 | 사용 사례 |
| --------- | --------------- | -------- |
| **프록시** (`.mock.json`) | 서버 측 요청(Next.js 등의 SSR fetch) | 서버가 API를 호출하는 풀스택 앱 |
| **HAR** (`.har`) | 브라우저 측 요청(브라우저 `fetch`, 확장 프로그램, SPA) | SPA, Chrome 확장 프로그램, 서드파티 API |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

각 테스트는 시작할 때 모드를 설정하며, 프록시는 받는 모든 요청에 하나의 모드를 유지하므로 동시에 실행되는 테스트는 같은 모드를 공유합니다. **기록** 모드에서 프록시는 실제 백엔드로 전달하고 응답을 저장하며, **재생** 모드에서는 저장된 응답을 디스크에서 제공하고 각 테스트의 id로 그 테스트의 기록을 고르며, **투명** 모드에서는 기록하지 않고 전달만 합니다. 프록시는 투명 모드로 시작하므로, 테스트 밖에서 프록시를 거쳐 실행한 앱은 평소처럼 백엔드와 통신합니다. 모드 전환 방법은 [제어 엔드포인트](/ko/docs/guides/control-endpoint/)를 참조하세요.

## 재생이 요청을 매칭하는 방식 {#replay-matching}

프록시와 HAR 파일은 기록된 응답을 서로 다른 방식으로 찾습니다.

| 재생 시 | 프록시(`.mock.json`) | HAR(`.har`) |
| --- | --- | --- |
| 매칭 기준 | 메서드, 경로, 쿼리 문자열의 MD5 해시. 본문은 비교하지 않습니다. | 메서드, URL, 본문. 그다음 요청 헤더가 가장 많이 겹치는 항목을 고릅니다. 같은 URL과 본문이라도 헤더로 구분되는 서로 다른 작업일 수 있기 때문입니다. 어떤 항목에도 없는 본문은 메서드와 URL만으로 매칭하며, multipart 경계(boundary)는 무시합니다. |
| 같은 요청이 다시 오면 | 기록된 순서에 따라 다음 기록. | 기록된 순서에 따라 다음 기록. 쓰기 요청에는 규칙이 하나 있습니다(아래 참고). |
| 기록이 없으면 | 요청을 명시한 JSON 본문과 함께 404. 또한 `playwrightProxy.before()`가 페이지를 닫아 테스트가 즉시 실패합니다(`failOnMissingRecording: false`로 끌 수 있습니다). | 요청이 중단되고, `[Client-Side Replay] No recorded response for <method> <url>` 로그가 남습니다. |
| 실제 API 도달 | `transparent` 모드에서만. | `url`과 일치하지 않는 요청만. |

### 서버 측 요청(프록시)

키는 메서드, 경로, 그리고 쿼리 문자열 MD5 해시의 앞 16자리 16진수 문자로 이루어집니다. `GET /todos?page=2`의 키는 `GET_todos_46589c7afd19c014.json`이므로, 쿼리 문자열이 조금이라도 다르면(파라미터 순서만 달라도) 다른 키가 됩니다.

같은 키의 호출은 기록된 순서대로 제공됩니다. 마지막 기록을 넘어선 호출은 마지막 응답을 다시 받고, 프록시는 `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`을 로그에 남깁니다.

기록이 없는 요청은 실제 API에 도달하지 않습니다. 프록시는 `[REPLAY ERROR]` 줄을 로그에 남기고 404로 응답합니다.

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

프록시는 `transparent` 모드에서만 실제 백엔드로 요청을 보냅니다. 재생 실행이 이 모드에 이르는 경우는 두 가지입니다. 테스트가 아직 진행 중일 때 `playwrightProxy.teardown()`이 실행되거나, 다음 `playwrightProxy.before()` 호출 전에 세션 시간 초과(기본값 120000 ms)가 다 되는 경우입니다. [FAQ](/ko/docs/reference/faq/#parallel-replay)에서 두 경우를 모두 설명합니다.

### 브라우저 요청(HAR)

`url`을 전달하면 `playwrightProxy.before()`가 일치하는 브라우저 요청을 Playwright의 HAR 레코더로 기록합니다.

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

재생은 `page.routeFromHAR()`가 아니라 이 파일을 읽는 라이브러리 자체의 `page.route()` 핸들러가 맡습니다. Playwright의 재생은 같은 요청이 반복될 때마다 처음 일치한 항목을 돌려주므로([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), `POST` 다음의 `GET`이 `POST` 이전의 목록을 보여 주었습니다. 이 핸들러는 대신 각 기록을 기록된 순서대로 한 번씩 제공하고, 페이지가 기록할 때보다 더 자주 요청할 때만 기록을 재사용합니다. 쓰기 요청 전후의 읽기 요청 순서는 규칙 하나가 정합니다. 어떤 경로에 대한 쓰기 요청(`GET`, `HEAD`, `OPTIONS`를 제외한 모든 메서드이므로 GraphQL 쿼리도 해당합니다)이 재생되면, 그 경로나 그 하위 경로에 대한 읽기 요청은 쓰기 요청 이후에 기록된 사본을 우선 사용합니다. 다음에 오는 이런 쓰기 요청 전까지 남은 사본이 없는 읽기 요청은 그 쓰기 요청 이전의 가장 최근 사본을 재사용합니다. 이 규칙 덕분에 React Strict Mode에서 fetch가 두 번 실행되는 경우처럼 앱의 읽기 횟수가 기록할 때와 달라도 재생이 올바르게 동작합니다. 기록된 리디렉션은 `.har` 안에서 따라갑니다. 브라우저의 후속 요청은 `page.route()`에 도달하지 않기 때문입니다. fetch는 최종 응답을 받고, 내비게이션은 리디렉션 대상으로 보내집니다.

`url`과 일치하지만 `.har`에 없는 요청은 중단됩니다. `url`과 일치하지 않는 요청은 가로채지 않으며, `transparent` 모드에서는 어떤 요청도 가로채지 않습니다. 이런 요청은 실제 네트워크로 나갑니다.

프록시 자체(`localhost:8100`)로 가는 요청은 예외입니다. `before()`는 HAR 핸들러 다음에 이 요청들을 위한 자체 핸들러를 등록하고, Playwright는 나중에 등록된 핸들러를 먼저 실행합니다. 이 핸들러가 요청을 프록시로 넘기면, 프록시는 서버 측 요청과 마찬가지로 `.mock.json`에서 재생합니다.
