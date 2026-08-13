---
title: AI 에이전트 스킬
description: test-proxy-recorder 스킬을 설치하여 AI 코딩 에이전트(Claude Code, Cursor, Copilot)가 올바른 프록시, 픽스처, SSR 설정 코드를 생성하게 하세요.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

AI 코딩 에이전트(Claude Code, Cursor, Copilot 등)를 사용한다면, 에이전트가 올바른 설정 코드를 생성하도록 스킬 로딩을 설정하세요. 스킬은 [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent)를 통해 `test-proxy-recorder` 패키지 안에 포함되어, 일반적인 패키지 매니저 업데이트를 따라 이동합니다.

**1. 라이브러리 설치** (스킬은 설치된 패키지에서 검색됩니다):

```bash
npm install --save-dev test-proxy-recorder
```

**2. 에이전트 지침 작성** — `install`은 에이전트 설정(`CLAUDE.md`, `.cursorrules` 등)에 검색 지침을 추가하여 에이전트가 필요할 때 일치하는 패키지 스킬을 로드하게 합니다.

```bash
npx @tanstack/intent@latest install
```

일반적인 검색 지침 대신 명시적인 작업-스킬 매핑을 에이전트 설정에 작성하고 싶다면 `--map`을 전달하세요.

그러면 에이전트는 별도 지침 없이도 올바른 프록시/픽스처 설정, 기록 vs. 재생 워크플로, Next.js SSR 헤더 패턴을 알게 됩니다.

## 스킬

`test-proxy-recorder`는 다음 스킬을 제공합니다.

- **`proxy-setup`** — 프록시 CLI, `package.json` 스크립트, `playwright.config.ts`의 `webServer`, 테스트별 픽스처, 기록/재생/투명 모드, 비밀 정보 마스킹, 그리고 한 번 기록 → 커밋 → CI 재생 수명 주기.
- **`nextjs-ssr`** — `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`로 서버 측 fetch에 태깅, build-and-start vs `next dev` 주의 사항, 그리고 미들웨어가 선택 사항인 이유.
- **`tanstack-start`** — TanStack Start 로더, 서버 함수, 서버 라우트에 태깅, build vs `vite dev` 주의 사항, 서버-브라우저 API URL 분리, TanStack Query SSR 프리페치, 그리고 실제 인증 패턴.

설치된 패키지에서 사용 가능한 것을 나열하거나 직접 로드하세요.

```bash
npx @tanstack/intent@latest list                          # 검색 가능한 스킬 표시
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## 스킬 유지 관리 (기여자용)

에이전트 스킬은 [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills)에 있습니다. 주기적으로, 그리고 라이브러리 API나 예제가 변경될 때마다 확인하세요.

```bash
npx @tanstack/intent@latest validate   # 구조/형식/줄 수 제한 검사(스킬 수정 커밋 전에 실행)
npx @tanstack/intent@latest stale      # 게시된 라이브러리 대비 버전 차이 표시 — 나열된 스킬 재검토
```

`validate`는 반드시 통과해야 합니다. `stale`은 권고 사항입니다. 릴리스 후 차이를 보고하면 영향을 받는 스킬 내용을 재검토하고(`library_version`도 올리고) 하세요.
