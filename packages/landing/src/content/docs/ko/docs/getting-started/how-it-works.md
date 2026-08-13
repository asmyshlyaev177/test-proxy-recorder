---
title: 작동 원리
description: test-proxy-recorder는 서버 측 요청을 위한 프록시와 브라우저 측 요청을 위한 HAR, 두 가지 메커니즘으로 트래픽을 기록합니다. 함께 또는 독립적으로 사용할 수 있습니다.
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: c82c75cbf1d14fc641da1da4d85b7713c5e612db
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

각 모드는 테스트 세션마다 설정됩니다. **기록** 모드에서 프록시는 실제 백엔드로 전달하고 응답을 저장하며, **재생** 모드에서는 저장된 응답을 디스크에서 제공하고, **투명** 모드에서는 기록하지 않고 전달만 합니다. 모드 전환 방법은 [제어 엔드포인트](/ko/docs/guides/control-endpoint/)를 참조하세요.
