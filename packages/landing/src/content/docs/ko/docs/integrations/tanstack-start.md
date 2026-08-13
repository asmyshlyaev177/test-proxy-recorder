---
title: TanStack Start
description: 기록 세션 헤더로 TanStack Start 서버 측 fetch에 태깅하여 SSR을 기록하고 재생합니다. registerProxyFetch(권장) 또는 호출별 createHeadersWithRecordingId를 통해 가능합니다.
i18nSource: docs/integrations/tanstack-start.md
i18nSourceBlob: 6367cedc46bf4ac859e573ca269e63e8d98be33a
---

TanStack Start는 로더와 서버 함수를 서버에서 실행하므로 그 `fetch` 호출이 브라우저 컨텍스트 없이 프록시를 통과합니다. [Next.js SSR](/ko/docs/integrations/nextjs/)과 같은 상황입니다. 프록시는 `x-test-rcrd-id` 헤더를 통해 그 요청들이 어떤 세션에 속하는지 식별합니다. Playwright의 `playwrightProxy.before()`가 SSR을 트리거하는 브라우저 내비게이션에 이미 설정해 두므로 id가 들어오는 서버 요청에 도착합니다. 해야 할 일은 **나가는 서버 측 요청에 id를 붙이는 것**뿐입니다. (브라우저 전용 테스트는 이 모든 것이 필요 없습니다. 프록시가 전역으로 설정된 세션으로 폴백합니다.)

:::caution[프로덕션 빌드로 기록하세요]
`vite dev`가 아니라 `vite build` + `node .output/server/index.mjs`(즉 `pnpm start`)로 기록하세요. 개발 서버의 요청별 컨텍스트는 `registerProxyFetch()`가 패치하는 프로덕션 런타임과 다릅니다. 프로덕션 서버는 프로덕션 모드로 실행되므로, e2e 실행 시 앱 프로세스에 `TEST_PROXY_RECORDER_ENABLED=true`를 설정하세요.
:::

## registerProxyFetch (권장)

**라우터 설정**의 한 줄이 모든 서버 측 `fetch`(라우트 로더, 서버 함수, 서버 라우트)에 태깅합니다.

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // 클라이언트/프로덕션에서는 TEST_PROXY_RECORDER_ENABLED=true가 아니면 아무 동작도 하지 않음
```

전역 `fetch`를 패치하여 TanStack Start의 서버 요청 컨텍스트(`getRequestHeader`)에서 현재 요청의 `x-test-rcrd-id`를 읽어 나가는 요청에 복사합니다. `src/router.tsx` 맨 위에 두세요. 그 모듈은 모든 SSR 요청에 대해 서버에서 실행되며, 호출은 멱등이고, 클라이언트에서는 아무 동작도 하지 않고, 레코더가 명시적으로 활성화되지 않는 한 프로덕션에서도 아무 동작도 하지 않습니다.

## 호출별 — createHeadersWithRecordingId

패치가 없습니다. 로더나 서버 함수 안의 단일 fetch에 사용하거나, 전역 `fetch`를 패치하고 싶지 않을 때 사용하세요.

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

직접 전달할 원시 id(또는 `null`)가 필요하다면 `getRecordingId()`도 내보내져 있습니다. 둘 다 서버 컨텍스트에서 현재 요청의 id를 읽으며, `TEST_PROXY_RECORDER_ENABLED=true`가 아니면 프로덕션에서 아무 동작도 하지 않습니다.

## 앱을 프록시로 연결

개발/테스트에서는 **두** 오리진이 모두 기록되도록 백엔드 기본 URL을 프록시로 연결하세요. 서버 측 기본값(로더/서버 함수가 읽는 `BACKEND_URL` 등)과 빌드 시 구워지는 브라우저 측 기본값(`VITE_API_URL`) 모두요. 프로덕션에서는 실제 백엔드로 연결하세요. 브라우저 측 요청은 [수동 설정](/ko/docs/getting-started/manual-setup/)과 동일하게 `playwrightProxy.before()`의 HAR 메커니즘이 처리합니다.

## 인증 앱

레코더는 [실제 인증 공급자와 함께 동작하며](/ko/docs/getting-started/how-it-works/)(AWS Cognito, Auth0, Clerk 등), 위의 SSR 태깅과 함께 구성됩니다. 패턴은 다음과 같습니다.

- **`transparent` 모드에서 실제로 로그인.** Playwright `setup` 프로젝트가 프록시를 통과시킨 상태로 한 번 로그인하므로 로그인은 **절대 기록되지 않고**, 인증된 스펙이 재사용할 세션(`storageState`)을 저장합니다.
- **보호된 요청은 토큰을 지니고 기록됩니다.** 각 인증 요청은 `Authorization: Bearer …` 헤더를 보내며, 레코더가 이를 [마스킹](/ko/docs/guides/secret-redaction/)하므로 커밋된 기록에 토큰이 도달하지 않습니다.
- **토큰이 저장된 위치가 메커니즘을 결정합니다.** `localStorage`의 토큰은 서버에서 읽을 수 없으므로 보호된 fetch는 브라우저에서 실행되어 HAR로 기록됩니다. SSR 프리페치가 없습니다. 반대로 쿠키 기반 세션은 `createHeadersWithRecordingId()`로 로더에 전달하여 서버 측에서 기록할 수 있습니다.

[`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) 앱에는 바로 이것을 보여 주는 실행 가능한 `/login` → `/dashboard` AWS Cognito 흐름(`e2e/setup-auth.ts` + `e2e/auth.spec.ts`)이 포함되어 있습니다.

## 전체 예제

완전하고 실행 가능한 앱(**TanStack Query**(SSR 프리페치 + `useMutation`)로 구축, todos(브라우저 + SSR), cache-header ISR 라우트, 마스킹 사례, WebSocket 채팅, 실제 AWS Cognito 로그인(투명 모드 인증 + 기록되고 토큰이 마스킹된 보호 API)을 모두 기록하고 재생)은 [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start)에 있습니다. 레코더가 데이터 계층에 투명함을 보여 줍니다. `registerProxyFetch()`가 Query 전용 코드 없이 SSR 중 Query의 `queryFn` fetch에 태깅합니다.
