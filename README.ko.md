<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · 한국어 · [Русский](./README.ru.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=ko source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **Playwright용 VCR** — 실제 API 응답을 한 번 기록하고, CI에서 결정적으로 재생합니다. Next.js 및 TanStack Start SSR, 브라우저, WebSocket 트래픽을 모두 지원합니다. 백엔드도, 직접 작성한 목(mock)도 필요 없습니다.

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="실제 API 응답을 기록한 뒤 백엔드를 끈 상태로 CI에서 재생하는 모습" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## 이유

불안정한 e2e 실행에는 모두 같은 근본 원인이 있습니다. 바로 네트워크입니다. 이 도구는 실제 트래픽을 한 번 기록한 뒤 CI에서 바이트 단위 그대로 재생하므로, 백엔드를 끈 상태에서도 테스트가 통과합니다.

- **CI에서 백엔드 불필요** — 디스크에서 재생하므로 네트워크가 필요 없습니다.
- **수동 목(mock) 불필요** — 실제 상호작용을 캡처하므로 픽스처를 직접 작성할 일이 없습니다.
- **SSR + 브라우저 + WebSocket** — 요청이 발생하는 위치와 무관하게 기록합니다.

## 비교

test-proxy-recorder는 직접 작성한 목(mock) 없이 SSR, 브라우저, WebSocket 전반에서 **실제** 트래픽을 기록하는 유일한 도구입니다. 바로 이 조합이 다른 도구들이 남겨 둔 공백입니다.

| 기능 | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| 실제 트래픽 기록 | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 서버 측(SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| 브라우저 측 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Playwright 네이티브 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| 유지 관리됨 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js는 Node HTTP를 가로채므로 앱 프로세스 내부에서 SSR 모킹이 가능하지만, Playwright 실행의 일부로는 불가능합니다. MSW와 Mocky Balboa도 실제 응답을 재생하지만, 기록하는 대신 목(mock)을 직접 작성해야 합니다.

자세한 비교는 [문서의 전체 비교](https://test-proxy-recorder.dev/docs/#comparison)를 참조하세요. 다른 도구를 선택해야 하는 경우도 여기에 포함되어 있습니다.

## 빠른 시작

**가장 빠른 방법 — AI 코딩 에이전트에게 맡기세요.** 이것을 복사하고 백엔드 URL을 바꾼 뒤 Claude Code / Cursor 등에 붙여넣으세요. (`init`을 실행하고 나머지 연결 작업을 마무리합니다.)

```text
# 이 프로젝트의 e2e 테스트용으로 test-proxy-recorder를 설정한 뒤, `init`이 출력하는 지침을 따르세요. 다음 명령을 실행합니다.
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# 그런 다음 init이 출력하는 앱별 단계를 완료하세요. 개발/테스트에서만 앱의 API 기본 URL을 프록시로 연결하고, 서버 측 fetch(Next.js)에 태깅하고, 스모크 테스트를 추가하고, 기록 → 재생을 검증합니다.
```

직접 연결하려면:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init`은 프록시 설정, Playwright 픽스처, 전역 티어다운, `package.json` 스크립트를 비파괴적으로 스캐폴딩하고, (Next.js의 경우) `registerProxyFetch()`를 통해 SSR fetch 태깅을 루트 레이아웃에 연결합니다. 마지막에는 스스로 추측할 수 없는 앱별 단계를 위한 맞춤형 AI 에이전트 프롬프트를 출력합니다.

`init`이 추측할 수 없는 유일한 것은 어떤 환경 변수가 API 기본 URL을 담고 있는지입니다. 레코더가 활성화되어 있으면 프록시를, 그렇지 않으면 실제 백엔드를 가리키세요. 프록시는 프로덕션에서 절대 실행되지 않습니다.

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // `init`에서의 프록시 주소
```

그런 다음 `MODE = 'record'`로 설정하고 실제 API를 대상으로 한 번 실행한 뒤, `'replay'`로 전환하고 `e2e/recordings/`를 커밋하세요. 이제 CI는 백엔드를 끈 상태로 실행됩니다.

전체 과정: [빠른 시작](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [수동 설정](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **방금 목(mock)을 직접 작성할 오후 시간을 아끼셨나요?**
> [GitHub에 ⭐](https://github.com/asmyshlyaev177/test-proxy-recorder)를 주는 데는 1초면 충분하며, 불안정한 e2e 테스트와 싸우고 있는 다음 사람이 이 도구를 발견하는 방법입니다. 저는 1인 메인테이너로서 모든 스타를 계속하라는 신호로 읽습니다.

## 예제

[`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps)에 각각 자체 README가 있는 완전한 동작 앱이 있습니다.

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + 브라우저 + WebSocket 채팅
- [Next.js Edge 런타임](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — 동시 재생을 위한 `registerProxyFetch`
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + 브라우저, TanStack Query, ISR, WebSocket, 실제 Cognito 로그인
- [Chrome 확장 프로그램](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — 브라우저 전용, 오프라인으로 재생
- [암호화폐 시세](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — 서드파티 WebSocket 피드
- [인증 앱](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — 실제 Cognito 로그인, 보호된 API 재생

## 문서

그 외의 모든 내용은 [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/)에 있습니다. [작동 원리](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [설정](https://test-proxy-recorder.dev/docs/guides/config/), [비밀 정보 마스킹](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [Next.js 통합](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [TanStack Start 통합](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [API 참조](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

AI 코딩 에이전트를 사용 중이신가요? `npx @tanstack/intent@latest install`을 실행하면 올바른 설정 코드를 생성하도록 스킬이 추가됩니다. [AI 에이전트 스킬 가이드](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/)를 참조하세요.

## 요구 사항

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (피어 의존성)

## 피드백 및 기여

이 프로젝트는 한 사람이 공개적으로 빌드하고 유지 관리하며, 모든 피드백이 다음에 만들 기능을 결정합니다.

- **[⭐ 저장소에 스타](https://github.com/asmyshlyaev177/test-proxy-recorder)** — 프로젝트를 지원하는 가장 빠른 방법이며, 다른 사람이 발견하는 데 실질적으로 도움이 됩니다.
- **불편한 점이 있거나 아이디어가 있으신가요?** [이슈를 열거나](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) [Discord](https://discord.gg/w7rgYbY5zz)에서 인사해 주세요. "이 부분이 헷갈렸어요" 한 줄도 큰 도움이 됩니다.
- **기여하고 싶으신가요?** PR을 환영합니다.

## AI 스킬

AI 코딩 에이전트(Claude Code, Cursor, Copilot 등)를 사용 중이신가요? 이 라이브러리는 에이전트가 올바른 설정 코드를 생성하도록 [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) 스킬을 제공합니다. 패키지를 설치한 다음 에이전트 지침을 작성하세요.

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install`은 에이전트 설정(`CLAUDE.md`, `.cursorrules` 등)에 스킬 검색 지침을 추가합니다. 에이전트는 필요할 때 `proxy-setup`, `nextjs-ssr`, `tanstack-start` 스킬을 로드합니다. `npx @tanstack/intent@latest list`와 `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`으로 직접 나열하거나 로드하세요. 전체 가이드: [AI 에이전트 스킬](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

스킬 소스는 [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/)에 있습니다.

## 채용

저는 **Aleksandr Smyshliaev**입니다. 이 도구의 작성자이자 메인테이너입니다. 시니어 프론트엔드 엔지니어(React / Next.js / TypeScript, 8년 이상)이며 **현재 풀타임 원격 근무가 가능합니다**.

이 프로젝트는 제가 다른 사람들의 불안정한 테스트 스위트를 수년간 고쳐 온 경험에서 비롯되었습니다. 코드베이스가 6개월 뒤에도 여전히 쾌적한지를 결정하는, 지루한 인프라가 제가 가장 잘하는 일입니다.

- **잘하는 일** — 리팩터링 후에도 살아남는 컴포넌트 라이브러리, 상태 관리, 테스트 스위트.
- **그 외 제가 만든 것** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (주간 설치 약 84k),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (타입 안전 URL
  상태), [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **위치** — 조지아 트빌리시(GMT+4), CET와 완전히 겹칩니다. 등록된 계약자 법인이 있어
  B2B 계약 시 고용 대행(EOR) 설정이 필요 없습니다.
- **연락처** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## 라이선스

MIT
