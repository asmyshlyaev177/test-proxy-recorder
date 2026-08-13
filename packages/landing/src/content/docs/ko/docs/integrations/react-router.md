---
title: React Router / Remix
description: test-proxy-recorder를 위한 1급 React Router 7(프레임워크 모드) 및 Remix 통합이 로드맵에 있습니다. 출시 전까지는 로더와 액션에서 기록 세션 헤더를 수동으로 전달하세요.
i18nSource: docs/integrations/react-router.md
i18nSourceBlob: 84a70df0fa049d7fe27235ed2884156c7bb75cfa
---

:::caution[로드맵에 있음]
React Router 7 프레임워크 모드(현재 실제로 "Remix"가 의미하는 것)를 위한 1급 어댑터가 계획되어 있지만 아직 출시되지 않았습니다. 이 페이지는 지금 당장 동작하는 수동 패턴을 설명하며, 어댑터가 출시되면 전용 가이드로 대체될 것입니다. 더 빨리 원하시나요? [이슈를 열어주세요](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

React Router 7의 로더와 액션은 서버에서 실행되므로 그 `fetch` 호출이 브라우저 컨텍스트 없이 프록시를 통과합니다. [Next.js SSR](/ko/docs/integrations/nextjs/)과 같은 상황입니다. 프록시는 그 서버 측 요청을 올바른 기록 세션에 귀속시키기 위해 `x-test-rcrd-id` 헤더가 필요합니다.

## 수동 패턴 (지금 동작)

각 로더/액션은 들어오는 `request`를 받습니다. 거기서 기록 id 헤더를 읽어 모든 서버 측 `fetch`에 전달하세요.

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // 개발/테스트에서만 API 기본값을 프록시로 연결하세요.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

개발/테스트에서만 백엔드 기본 URL을 프록시(`http://localhost:8100`)로 연결하세요. [수동 설정](/ko/docs/getting-started/manual-setup/)과 동일합니다. 브라우저 측 요청은 여전히 `playwrightProxy.before()`의 HAR 메커니즘이 처리합니다.

어댑터가 출시되면 이는 단일 헬퍼 임포트로 줄어듭니다. 진행 상황은 [로드맵](https://github.com/asmyshlyaev177/test-proxy-recorder#readme)에서 확인하세요.
