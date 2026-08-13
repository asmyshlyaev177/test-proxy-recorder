---
title: 빠른 시작
description: 하나의 init 명령으로 test-proxy-recorder를 설정합니다. AI 에이전트로 진행하는 것이 가장 좋습니다. API를 프록시로 연결하고, 한 번 기록한 뒤 CI에서 재생합니다.
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 1f0c3114d600fcebf0696c67788cd60c9b6558db
---

## AI 에이전트로 설정(권장)

이것을 복사해서 AI 코딩 에이전트(Claude Code, Cursor 등)에 붙여넣으세요.

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

에이전트는 스킬을 추가하고, `init`으로 모든 것을 스캐폴딩하며(설정, Playwright 픽스처, 티어다운, 스크립트, 그리고 Next.js의 경우 루트 레이아웃의 `registerProxyFetch()`), `init`이 추측할 수 없는 연결 작업은 `init`이 출력하는 프롬프트에서 마무리합니다. 복사할 완성된 설정이 필요하신가요? [예제](/ko/docs/reference/examples/)를 참조하세요.

## 또는 직접 연결

`init`은 모든 것을 작성하고 아무것도 덮어쓰지 않습니다.

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # Next.js 전용 — registerProxyFetch()를 추가해 SSR fetch에 태깅
e2e/fixtures.ts          # 기록 vs 재생
e2e/global-teardown.ts
package.json             # + proxy / test:e2e 스크립트
```

### 1. 앱의 API를 프록시로 연결

`init`이 추측할 수 없는 유일한 것은 바로 API 기본 URL을 담고 있는 환경 변수입니다. 레코더가 활성화되어 있으면 프록시를, 그렇지 않으면 실제 백엔드를 가리키세요. 프록시는 프로덕션에서 절대 실행되지 않습니다.

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init`에서의 프록시 주소
```

### 2. 서버 측 fetch 태깅(Next.js 전용)

브라우저 요청은 이미 기록 세션 id를 지니고 있습니다(Playwright가 설정합니다). 서버 측 fetch(SSR, 서버 컴포넌트)의 경우 루트 레이아웃에 한 줄을 추가해 함께 태깅하세요. `init`이 대신 해 줍니다.

```tsx
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

서버 측 호출에 axios를 사용하시나요? 대신 `registerProxyAxios(instance)`를 사용하세요. 프로덕션 빌드(`next build && next start`)로 기록하세요. `next dev`가 아닙니다. 브라우저 전용 앱(SPA, 확장 프로그램)은 이 단계를 건너뛸 수 있습니다.

### 3. 한 번 기록하고 영원히 재생

```bash
# fixtures.ts: MODE = 'record' — 실제 응답 캡처
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — 그런 다음 기록 커밋
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

이제 CI는 백엔드를 끈 상태로 재생합니다. 매번 동일한 응답입니다.

---

자세한 내용: [수동 설정](/ko/docs/getting-started/manual-setup/) · [작동 원리](/ko/docs/getting-started/how-it-works/) · [AI 에이전트 스킬](/ko/docs/reference/ai-agent-skills/).
