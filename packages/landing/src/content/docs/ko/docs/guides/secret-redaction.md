---
title: 비밀 정보 마스킹
description: 마스킹은 기본적으로 활성화되어 있습니다. Authorization, Cookie, Set-Cookie가 디스크에 기록되기 전에 제거됩니다. 헤더 및 본문 패턴을 추가하거나, 쿠키를 허용 목록에 넣거나, 프로그래밍 방식으로 마스킹할 수 있습니다.
i18nSource: docs/guides/secret-redaction.md
i18nSourceBlob: 1b03e54f96e418edf62ea8dd611fcc2fc4f30bbc
---

기록은 git에 커밋되므로, 디스크에 쓰기 전에 비밀 정보가 제거됩니다. 마스킹은 **기본적으로 활성화**되어 있으며, 프록시는 다음 요청/응답 헤더의 값을 `[REDACTED]`로 바꿉니다.

- `Authorization`
- `Cookie`
- `Set-Cookie`

이것은 안전합니다. 재생 매칭은 이 헤더들을 무시하므로 마스킹이 재생을 깨뜨리지 않습니다. `.mock.json` 기록, WebSocket 기록, `.har` 파일에 적용됩니다. 마스킹을 끄려면 CLI에서 `--no-redact`를 전달하거나 [설정](/ko/docs/guides/config/)에서 `redaction: false`로 설정하세요.

일부 쿠키만 민감한 경우, 무해한 쿠키를 이름으로 허용 목록에 추가하세요(예: `theme` 또는 A/B 테스트 쿠키). 허용 목록의 쿠키는 `Cookie`/`Set-Cookie` 안에서 값을 유지하고, 나머지 쿠키는 여전히 마스킹됩니다.

:::note[`.har` 파일이 마스킹되는 방식]
`.har` 파일은 프록시가 아니라 Playwright의 `routeFromHAR`가 작성하므로 별도의 과정에서 마스킹됩니다. `playwrightProxy.teardown()`은 프록시와 **동일한 마스킹 설정**(헤더, `allowCookies`, `bodyPatterns`가 모두 적용되며, 헤더와 파싱된 `cookies` 배열 양쪽에 적용)을 사용해 기록 디렉터리의 모든 `.har`를 다시 작성합니다. 이것은 Playwright **`globalTeardown`**에서 실행되므로, HAR 마스킹에는 `playwrightProxy.teardown()`을 호출하는 `globalTeardown`이 필요합니다([권장 설정](/ko/docs/integrations/playwright/#global-teardown-recommended), `init`이 스캐폴딩).

테스트별로 실행할 수는 없습니다. Playwright는 컨텍스트가 닫힐 때 HAR을 플러시하지만 close 핸들러를 기다리지 않으므로, 그곳에서 마스킹하면 프로세스 종료와 경쟁하여 파일이 잘릴 수 있습니다. 티어다운은 `/__control`에서 설정을 가져오며(프록시가 실행 중이어야 하고, 접근할 수 없으면 내장 헤더 기본값이 그대로 적용됩니다), 실제로 변경한 파일만 다시 쓰고, base64 응답 본문은 그대로 둡니다. 심층 방어를 위해 단기 유효 테스트 자격 증명으로 기록하고 커밋 전에 HAR을 검토하세요. 아래 권장 인증 패턴을 참조하세요.
:::

## 권장 인증 패턴

로그인 흐름과 자격 증명을 기록에서 완전히 빼려면, 프록시를 `transparent` 모드로 둔 Playwright **setup 프로젝트**에서 인증을 실행하고, `storageState`를 **gitignore된** `auth-state.json`에 저장한 뒤 테스트에서 재사용하세요. 그러면 기록된 요청에는 (마스킹된) 세션 헤더만 담기고 로그인은 절대 담기지 않습니다.

실제 인증 공급자에 대한 동작하는 설정은 [인증 앱 예제](/ko/docs/reference/examples/#authenticated-app)를 참조하세요.

## 마스킹 대상 조정

기본 헤더는 항상 적용되며(마스킹이 켜져 있는 동안), 여기에 더 추가할 수 있습니다.

### CLI 플래그

- `--no-redact` — 비밀 정보 마스킹 비활성화(기본적으로 활성화).
- `--redact` — 비밀 정보 마스킹 활성화. 설정에서 `redaction: false`로 되어 있을 때 다시 켤 때만 필요.
- `--redact-headers <names>` — 마스킹할 추가 헤더 이름(쉼표로 구분, 기본값과 병합).
- `--redact-body <patterns>` — 요청/응답 본문에서 마스킹할 정규식 패턴(쉼표로 구분).
- `--allow-headers <names>` — 마스킹에서 제외할 헤더 이름(쉼표로 구분, 예: `set-cookie`).
- `--allow-cookies <names>` — `Cookie`/`Set-Cookie` 안에서 마스킹하지 않을 쿠키 이름(쉼표로 구분).

```bash
# 마스킹은 이미 켜져 있습니다. API 키 헤더와 "sk_live_..." 토큰도 마스킹하고, theme 쿠키는 유지
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### 프로그래밍 방식

`ProxyServer`를 직접 구성하는 경우:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// 이 객체를 전달하면 마스킹이 활성화됩니다. 끄려면 `false`(또는 아무것도) 전달하세요.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // 추가 헤더 — 기본값과 병합됨
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // 요청/응답 본문에서 치환할 정규식
  allowHeaders: ['set-cookie'],        // 이 헤더는 절대 마스킹하지 않음
  allowCookies: ['theme', 'locale'],   // 이 쿠키는 Cookie/Set-Cookie 안에 유지
  placeholder: '[REDACTED]',           // 기본값
});
```

기존 기록을 직접 마스킹하고 싶다면 `redactSession(session, config)`도 내보내져 있습니다.
