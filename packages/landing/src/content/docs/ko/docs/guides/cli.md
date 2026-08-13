---
title: CLI
description: test-proxy-recorder 명령줄 인터페이스 — 옵션, WebSocket 재생 페이싱, 그리고 멈춘 프록시를 재설정하는 방법.
i18nSource: docs/guides/cli.md
i18nSourceBlob: 354b4fe6118719c0fdbfe91d37a9c3db2ab33bd7
---

```bash
test-proxy-recorder <target-url> [options]
```

| 옵션            | 기본값         | 설명                                 |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(필수)*   | 프록시할 백엔드 URL                  |
| `--port, -p`     | `8000`         | 프록시 수신 포트                     |
| `--dir, -d`      | `./recordings` | 기록 파일 디렉터리                   |
| `--timeout, -t`  | `120000`       | 세션 자동 재설정 시간 초과(ms)        |
| `--config, -c`   | *(자동)*   | 설정 파일 경로                      |
| `--ws-timing`    | `burst`        | WebSocket 재생 페이싱 — `burst` 또는 `original` |

비밀 정보 마스킹은 **기본적으로 활성화**되어 있습니다. Authorization/Cookie/Set-Cookie가 기록에서 자동으로 제거됩니다. `--no-redact` 또는 [설정](/ko/docs/guides/config/)의 `redaction: false`로 끌 수 있습니다. 마스킹 대상을 추가하는 `--redact-headers`와 `--redact-body` 플래그는 [비밀 정보 마스킹](/ko/docs/guides/secret-redaction/)을 참조하세요.

```bash
# 예시
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## WebSocket 재생 페이싱

기본적으로 기록된 WebSocket 서버 메시지는 연결 시 **버스트(burst)**로 재생됩니다. 가장 빠르고 완전히 결정적이어서 CI에 이상적입니다. 대신 `--ws-timing original`(또는 설정의 `websocket: { timing: 'original' }`)을 전달하면 기록된 타임스탬프로 다시 페이싱하여 메시지가 실제 메시지 간격을 두고 도착합니다. 이렇게 하면 테스트가 기록의 실제 경과 시간만큼 걸립니다.

`playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`를 통해 **테스트별로** 설정할 수도 있습니다. 해당 세션에 한해 프록시 수준 기본값을 덮어씁니다.

## 멈춘 프록시 재설정

프록시는 각 세션의 시간이 초과되면 자동으로 `transparent`로 되돌아가고, `globalTeardown`이 정상 종료 시 프록시를 재설정합니다. 그러나 **중단된** 실행(`Ctrl+C`), UI/디버그 세션, 또는 `globalTeardown`이 없는 설정은 공유 프록시를 `record`/`replay`에 멈춰 있게 만들 수 있습니다. 그러면 앱이 실제 백엔드 대신 기록된 응답을 계속 제공합니다. 필요할 때 재설정하세요.

```bash
test-proxy-recorder reset    # 또는: npm run proxy:reset
```

이 명령은 `{ "mode": "transparent" }`를 `/__control`로 POST합니다. `curl`로 직접 재설정하는 방법을 대체하는, 지원되고 병렬 실행에도 안전한 방법입니다. 언제든 안전하게 실행할 수 있으며, 접근할 수 없는 프록시는 아무 동작도 하지 않는 것으로 처리됩니다. 포트는 **`--port` 플래그 → `TEST_PROXY_RECORDER_PORT` 환경 변수 → 설정 파일 → `8000`** 순서로 결정되므로, 프록시가 시작된 포트를 대상으로 합니다(덮어쓰려면 `--port` / `--config`를 전달하세요). `init`은 이것을 `proxy:reset` 스크립트로 스캐폴딩합니다.

## `init` — 설정 스캐폴딩

`npx test-proxy-recorder init`으로 한 번에 설정하는 권장 방법은 [빠른 시작](/ko/docs/getting-started/quick-start/)을 참조하세요.
