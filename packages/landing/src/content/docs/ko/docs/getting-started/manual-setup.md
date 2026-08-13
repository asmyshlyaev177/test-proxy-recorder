---
title: 수동 설정
description: test-proxy-recorder를 풀스택(SSR + 브라우저) 앱이나 브라우저 전용 SPA 또는 확장 프로그램에 직접 연결한 뒤, 한 번 기록하고 CI에서 재생하는 방법을 설명합니다.
i18nSource: docs/getting-started/manual-setup.md
i18nSourceBlob: e501bd33c560757d3deacdb3ff90681668099473
---

대부분은 [`init`](/ko/docs/getting-started/quick-start/)을 실행하는 편이 좋습니다. 아래 모든 파일을 대신 작성해 줍니다. 이 페이지는 `init`이 생성하는 내용의 참조 자료이므로, 직접 연결하거나 코드 생성을 버리거나 각 부분을 이해하는 데 쓸 수 있습니다.

## 풀스택(SSR + 브라우저)

서버와 브라우저가 모두 API를 호출하는 Next.js 및 유사 프레임워크용입니다. 두 기록 메커니즘을 함께 사용하세요. [작동 원리](/ko/docs/getting-started/how-it-works/)를 참조하세요.

프록시는 **테스트 실행 동안 앱 옆에서** 시작하는 가벼운 프로세스입니다(아래처럼 스크립트를 통해, 또는 Playwright의 `webServer`로). 배포하거나 유지 관리할 인프라가 아닙니다. 전체 설정은 이렇습니다. 앱 옆에서 프록시를 시작하고, 앱의 API 기본 URL을 프록시로 연결하고, SSR에서 세션 헤더를 전파하고, 픽스처를 하나 작성하면 됩니다.

### 1. `package.json`에 스크립트 추가

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

앱 코드에서, 레코더가 활성화되어 있으면 API 기본 URL을 프록시로, 그렇지 않으면 실제 백엔드로 연결하세요. 프록시는 프로덕션에서 절대 실행되지 않습니다.

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // 프록시 주소
```

`TEST_PROXY_RECORDER_ENABLED`는 위의 `dev:proxy` / `serve:proxy` 스크립트와 `init`이 생성한 스크립트가 설정합니다. 앱이 이미 API 기본 URL에 사용하는 환경 변수(예: `API_URL`, `NEXT_PUBLIC_API_URL`)를 그대로 사용하면 됩니다. 동일한 조건부가 적용됩니다.

:::note[Next.js]
테스트를 기록하고 재생할 때는 `dev`보다 `build` + `serve`를 선호하세요. Next.js 개발 서버는 느리고 시간 초과나 불안정한 기록을 유발할 수 있습니다.
:::

### 2. 서버 측 fetch 태깅(Next.js)

서버 측 `fetch` 호출은 프록시가 어떤 테스트에 속하는지 알 수 있도록 기록 세션 헤더가 필요합니다. Playwright가 브라우저 내비게이션에 이미 설정해 두므로 id가 `next/headers`에 있습니다. 그 id를 나가는 SSR 요청에 붙이기만 하면 됩니다. 루트 레이아웃에 한 줄을 추가하세요(`init`이 대신 해 줍니다).

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // 프로덕션에서는 TEST_PROXY_RECORDER_ENABLED=true가 아니면 아무 동작도 하지 않음

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

이 방법은 Node **및** Edge 런타임에서 동작합니다. axios 앱에서는 각 서버 측 인스턴스에 `registerProxyAxios(instance)`를 호출하고, 단일 fetch에는 `createHeadersWithRecordingId(await headers())`가 패치 없는 대안입니다. `setNextProxyHeaders`를 쓰는 `proxy.ts`/`middleware.ts`는 **선택 사항**입니다. id만 노출할 뿐 fetch에 태깅하지는 않습니다. **프로덕션 빌드**(`next build && next start`)로 기록하세요. `next dev`가 아닙니다. 자세한 내용은 [Next.js 통합](/ko/docs/integrations/nextjs/)을 참조하세요. 브라우저 전용 앱은 이 단계를 건너뛸 수 있습니다.

### 3. 테스트 작성

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR 요청(서버 → 프록시)은 .mock.json에 기록됩니다.
// 프록시 URL로 가는 브라우저 요청도 함께 처리됩니다.
const CLIENT_SIDE_URL = /localhost:8100/;

// 기록을 갱신하려면 'record'로 변경하세요.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. 기록

```bash
# 터미널 1
npm run serve:proxy

# 터미널 2 — .mock.json과 .har 파일이 자동으로 작성됩니다
npx playwright test
```

### 5. 재생으로 전환하고 커밋

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## 브라우저 전용 / SPA / 확장 프로그램

모든 API 호출이 브라우저에서 오는 경우(SSR 없음)에는 HAR 메커니즘만 있으면 됩니다. 실제 기록에는 프록시 백엔드가 필요 없으며, 프록시 프로세스는 세션 관리만 제공합니다.

### 1. 설치

```bash
npm install --save-dev test-proxy-recorder
```

### 2. `playwright.config.ts`에 프록시 추가

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

프록시 대상(`https://api.example.com`)은 브라우저 전용 기록에서는 중요하지 않습니다. 서버 측(SSR) 요청도 프록시로 통과시켜야 하는 경우에만 사용됩니다. 세션 관리를 위해 `/__control` 엔드포인트를 사용할 수 있도록 프록시 프로세스가 실행 중이어야 합니다.

### 3. 픽스처 작성

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// 브라우저가 요청을 보내는 외부 API 도메인과 일치시키세요.
// 기록 모드에서는 이 요청들이 실제 API로 가서 저장됩니다.
// 재생 모드에서는 디스크에서 제공됩니다. 네트워크가 필요 없습니다.
const CLIENT_SIDE_URL = /api\.example\.com/;

// 실제 API를 호출해 기록을 갱신하려면 'record'로 변경하세요.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. 테스트 작성

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. 기록 — 실제 API를 대상으로 한 번 실행

```bash
# fixtures.ts에서: const MODE = 'record' as const;
npx playwright test
# .har 파일이 e2e/recordings/에 자동으로 작성됩니다
```

### 6. 재생으로 전환하고 커밋

```bash
# fixtures.ts에서: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

이제 CI는 네트워크 접근 없이 실행됩니다.

:::caution
`e2e/recordings`를 `.gitignore`에 추가하지 **마세요**. CI 재생을 위해서는 기록이 git에 있어야 합니다.
:::

PR diff에서 큰 기록 파일을 접히게 하려면 `.gitattributes`에 이것을 추가하세요.

```text
/e2e/recordings/** binary
```
