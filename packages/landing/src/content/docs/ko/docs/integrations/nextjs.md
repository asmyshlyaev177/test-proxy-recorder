---
title: Next.js
description: 기록 세션 헤더로 Next.js 서버 측 fetch에 태깅하여 SSR을 기록하고 재생합니다. registerProxyFetch(권장, 모든 런타임), axios용 registerProxyAxios, 또는 호출별 createHeadersWithRecordingId를 통해 가능합니다. 미들웨어는 선택 사항입니다.
i18nSource: docs/integrations/nextjs.md
i18nSourceBlob: 5cf29035e538718ddd86bfc78d782a0468c8c3f7
---

Next.js 같은 SSR 프레임워크는 브라우저 컨텍스트 없이 프록시를 통과하는 서버 측 `fetch` 호출을 수행합니다. 프록시는 `x-test-rcrd-id` 헤더를 통해 그 요청들이 어떤 세션에 속하는지 식별합니다. Playwright의 `playwrightProxy.before()`가 SSR을 트리거하는 브라우저 내비게이션에 이미 설정해 두므로 id가 `next/headers`에 있습니다. 해야 할 일은 **나가는 서버 측 요청에 id를 붙이는 것**뿐입니다. (브라우저 전용 테스트는 이 모든 것이 필요 없습니다. 프록시가 전역으로 설정된 세션으로 폴백합니다.)

:::tip
[`test-proxy-recorder init`](/ko/docs/getting-started/quick-start/)은 Next.js를 감지하고 아래 권장 방식을 루트 레이아웃에 자동으로 연결합니다.
:::

:::caution[프로덕션 빌드로 기록하세요]
`next dev`가 아니라 `next build && next start`로 기록하세요. 개발 서버는 요청 사이에 전역 `fetch` 패치를 초기화할 수 있으며([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), 더 느리고 불안정합니다. `next start`는 프로덕션 모드로 실행되므로, e2e 실행 시 앱 프로세스에 `TEST_PROXY_RECORDER_ENABLED=true`를 설정하세요.
:::

## registerProxyFetch (권장)

**루트 레이아웃**의 한 줄이 모든 서버 측 `fetch`(서버 컴포넌트, 라우트 핸들러, Node **및** Edge 런타임)에 태깅합니다.

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // 프로덕션에서는 TEST_PROXY_RECORDER_ENABLED=true가 아니면 아무 동작도 하지 않음
```

전역 `fetch`를 패치하여 현재 요청의 `x-test-rcrd-id`를 나가는 요청에 복사하므로, 프록시가 동시 재생 세션을 구분할 수 있습니다. 루트 레이아웃에서 호출하세요. `instrumentation.ts`가 **아닙니다**. Edge 런타임에서 라우트를 렌더링하는 컨텍스트와 다르므로, 그곳에 패치하면 조용히 전혀 실행되지 않습니다.

## axios — registerProxyAxios

서버 측 요청이 axios를 통과한다면, 각 서버 측 인스턴스를 한 번 등록하세요.

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

id를 찍어 주는 요청 인터셉터를 추가하며(전역 `fetch`는 건드리지 않음), 위의 개발 서버 주의 사항에 영향을 받지 않습니다. 프로덕션/브라우저에서는 아무 동작도 하지 않고, 인스턴스별로 멱등이며, 호출자가 설정한 id를 절대 덮어쓰지 않습니다.

## 호출별 — createHeadersWithRecordingId

패치가 없고 `next dev`에서도 동작합니다. 단일 fetch에 사용하거나, 전역 `fetch`를 패치하고 싶지 않을 때 사용하세요.

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## 미들웨어 (선택 사항)

`setNextProxyHeaders`를 호출하는 `proxy.ts`(Next.js 16+, `proxy` 내보내기) 또는 `middleware.ts`(15 이하, `middleware` 내보내기)는 id를 `next/headers`로 사용할 수 있게 하지만 **나가는 fetch에 태깅하지는 않습니다**. 따라서 위 헬퍼 중 하나를 사용하면 필요하지 않습니다. 이미 미들웨어(인증 등)를 보유한 경우에만 사용하고, 태깅을 위해 헬퍼와 함께 사용하세요.

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // id를 노출합니다. 위 헬퍼와 함께 사용하세요.
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`test-proxy-recorder/nextjs` 헬퍼의 전체 시그니처는 [API 참조](/ko/docs/reference/api/readme/)를 참조하세요. 완전하고 실행 가능한 Edge 프로젝트는 [Edge 런타임 예제](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge)에 있습니다.

## 캐싱 및 ISR

테스트를 위해 캐싱을 비활성화하지 마세요. 레코더는 캐시된/ISR 라우트와 함께 동작합니다. 다만 전체 설계를 결정하는 규칙이 하나 있습니다. **SSR fetch를 재생하려면 페이지가 요청 시점에 그 fetch를 실행해야 합니다.** 사전 렌더링된 HTML이나 오래된 캐시 렌더를 제공하는 라우트는 fetch를 수행하지 않으므로, 프록시가 제공할 것이 없고 단언은 오래된 콘텐츠를 보게 됩니다.

결정적으로 유지하는 방법은 SSR fetch를 fetch 수준의 `next.revalidate` + `next.tags`로 캐시하고, 단언 전에 필요에 따라 무효화하는 것입니다.

```tsx
// app/isr/page.tsx — `export const dynamic` 없음, `export const revalidate` 없음
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // Next.js 16은 두 번째 profile 인자가 필요합니다
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // 강제 삭제
await page.goto('/isr');                     // 내비게이션 한 번 — 결정적
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

**fetch** 캐시 항목에 대한 `revalidateTag`는 *강제 삭제*입니다. 다음 읽기는 캐시 미스가 되어 차단되고 프록시를 통해 다시 가져옵니다. 하나의 `next start` 프로세스에서 기록 → 재생 단계를 넘어 데이터 캐시가 유지되므로, 재생 내비게이션 전에 삭제해야 합니다. 그렇지 않으면 재생이 기록 단계의 캐시를 제공하여 프록시에 도달하지 않습니다(거짓 통과).

테스트 중에는 패치된 `fetch`가 `headers()`를 읽으므로 페이지가 동적으로 렌더링되고 실제로 fetch를 실행합니다. 프로덕션(레코더 비활성화)에서는 아무것도 `headers()`를 읽지 않으므로 페이지가 평소처럼 정적 ISR입니다. 동적 렌더링은 테스트로 한정되며, SSR fetch를 기록하는 데 본질적인 부분입니다.

:::caution[이 경우 `unstable_cache`를 피하세요]
`unstable_cache`는 *stale-while-revalidate*입니다. `revalidateTag`가 항목을 오래된 것으로 표시하고, 다음 읽기는 오래된 값을 반환하며 **백그라운드**에서 재생성하므로, 새 값은 단언 이후에 도착합니다. `force-dynamic` 페이지에서도, 워밍업 요청이 있어도 불안정합니다. 대신 fetch 수준의 `next.tags`(강제 삭제)를 사용하세요.
:::

요청 시 재검증은 특권이 있는 동작이므로(캐시를 삭제하고 재생성을 강제), 공유 시크릿 뒤에 라우트를 가두세요. 설정되지 않으면 실패로 닫고, 상수 시간으로 비교하고, 테스트에서 Playwright `use.extraHTTPHeaders`를 통해 토큰을 붙여 스펙이 토큰을 다루지 않게 하세요.

완전하고 실행 가능한 예제([Next.js 16 예제](/ko/docs/reference/examples/#nextjs-16)의 일부)를 참조하세요.

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — 캐시된 페이지(fetch 수준의 `next.tags`)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — `revalidateTag` 보호 방법: 실패로 닫기 + 상수 시간 시크릿 비교
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — 무효화 후 내비게이션 한 번. 재검증 호출이 성공했는지 단언
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — `.env`를 로드하고 `extraHTTPHeaders`로 시크릿을 첨부

## package.json 스크립트

서비스는 `playwright.config.ts`가 아니라 스크립트에서 시작하세요.

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

완전하고 실행 가능한 프로젝트는 [Next.js 16 예제](/ko/docs/reference/examples/#nextjs-16)에 있습니다.
