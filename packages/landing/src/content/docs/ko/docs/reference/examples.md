---
title: 예제 앱
description: test-proxy-recorder의 완전한 동작 예제 — Next.js 및 TanStack Start SSR, Chrome 확장 프로그램, 서드파티 WebSocket 시세 표시, 백엔드 없이 재생되는 인증 앱.
i18nSource: docs/reference/examples.md
i18nSourceBlob: d58a37f3eb41cbc0c0319b630b35da2930081ea1
---

완전한 동작 예제는 [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps)에 있습니다. 기록 메커니즘별로 하나씩이며, 각각 전체 설정과 기록/재생 워크플로가 담긴 자체 README가 있습니다.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — 목(mock) 백엔드, 프록시, Playwright e2e 테스트를 갖춘 Next.js 16 todo 앱입니다. SSR fetch(`.mock.json`)와 브라우저 fetch(`.har`)를 모두 기록하며, 로컬 백엔드에 대한 WebSocket 채팅을 포함합니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md)를 참조하세요.

## Next.js Edge 런타임 {#nextjs-edge}

[`apps/example-nextjs-edge`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — 페이지가 **Edge 런타임**(`export const runtime = 'edge'`)에서 렌더링되는 Next.js 16 앱입니다. SSR `fetch`는 `registerProxyFetch()`(루트 레이아웃에서 호출)를 통해 기록 세션 id로 태깅되므로, `instrumentation.ts`가 도달할 수 없는 곳에서도 동시 재생 세션이 구분됩니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs-edge/README.md)를 참조하세요.

## TanStack Start {#tanstack-start}

[`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — **TanStack Query**로 구축된 TanStack Start(Vite + Nitro) 앱입니다. SSR fetch(`.mock.json`, `src/router.tsx`의 `registerProxyFetch()`로 태깅)와 브라우저 fetch(`.har`)를 모두 기록하며, 실시간 todo 목록, cache-header ISR 라우트, WebSocket 채팅, 실제 **AWS Cognito** 로그인(투명 모드 인증 + 토큰이 마스킹된 보호 API)을 다룹니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-tanstack-start/README.md)를 참조하세요.

## Chrome 확장 프로그램 {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — 콘텐츠 스크립트에서 X/Twitter API를 호출하는 실제 Chrome 확장 프로그램입니다. 브라우저 요청을 `.har`에 기록하고 오프라인으로 재생하며, CI에 실시간 API나 계정이 필요 없습니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md)를 참조하세요.

## 암호화폐 시세 — 서드파티 WebSocket {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — Binance 공개 WebSocket 피드가 제공하는 실시간 BTC-USD 시세 표시입니다. 실제 피드를 프록시를 통해 한 번 기록한 뒤, 네트워크나 거래소 계정 없이 CI에서 결정적인 가격을 재생합니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md)를 참조하세요.

## 인증 앱 {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — **실제 AWS Cognito** 사용자 풀에 로그인한 뒤 보호된 API를 기록/재생하는 Next.js 앱입니다. 로그인은 매 실행마다 실시간으로 유지되고(절대 기록되지 않음), 보호된 데이터는 백엔드를 끈 상태로 재생되며, 인증 토큰은 기록에서 마스킹됩니다. 통합은 몇 개의 파일에 불과합니다. [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md)를 참조하세요. **클라우드 계정 없이** 동일한 패턴을 보려면 [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock)를 참조하세요.
