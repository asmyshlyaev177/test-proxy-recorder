---
title: 제어 엔드포인트
description: 프록시는 transparent, record, replay 모드 간의 프로그래밍 방식 전환을 위해 /__control을 노출합니다.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

프록시는 프로그래밍 방식 모드 전환을 위해 `/__control`을 노출합니다.

```bash
# 현재 상태 조회
curl http://localhost:8100/__control

# 모드 전환
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // cleanup이 true가 아니면 필수
  id?: string;       // record/replay에 필수(cleanup에도 필수)
  timeout?: number;  // 자동 재설정 시간 초과(ms, 기본값: 120000)
  cleanup?: boolean; // true이면 모드를 전환하는 대신 이 id의 세션을 저장하고 닫음
  websocket?: WebSocketReplayConfig; // 세션별 WebSocket 재생 페이싱 덮어쓰기
}
```

대부분의 설정에서는 이것을 직접 호출하지 않습니다. `playwrightProxy.before()`와 `setProxyMode()`([API 참조](/ko/docs/reference/api/readme/) 참조)가 대신 POST합니다. 셸, CI 단계, 또는 AI 에이전트에서 프록시를 제어할 때 `/__control`을 사용하세요.

## 세션

프록시는 재생 모드와 마찬가지로 기록 모드에서도 테스트 id마다 세션을 하나씩 유지하므로, 병렬 워커에서 실행되는 테스트가 프록시 하나를 공유합니다. 각 요청은 `x-test-rcrd-id` 헤더에, 또는 브라우저 WebSocket 핸드셰이크라면 `proxy-recording-id` 쿠키에 지정된 세션으로 갑니다. 2.0.1 이하 버전은 모든 요청에 하나의 기록 세션을 유지했습니다.

- **`{"mode": "record", "id": "my-test-1"}`**는 그 세션의 기록을 시작합니다. 이미 기록 중인 세션은 계속 기록합니다.
- **`{"id": "my-test-1", "cleanup": true}`**는 그 세션에만 작용합니다. 재생 세션은 닫힙니다. 기록 세션은 자기 `.mock.json`에 저장되고, `transparent`로 전환될 때까지 그 세션을 지정한 요청을 계속 기록하므로, 그 테스트에서 늦게 도착한 요청도 저장됩니다.
- **`{"mode": "transparent"}`**는 모든 세션을 저장하고 끝내므로, 모든 요청이 대상으로 그대로 전달됩니다. `playwrightProxy.teardown()`이 이것을 보냅니다. `timeout`이 다 되면 모드 타이머도 같은 일을 하며, 전환할 때마다 타이머가 다시 시작됩니다.

세션을 지정하지 않은 요청은 실행 중인 유일한 세션으로 갑니다. 여러 세션이 실행 중이면 프록시는 기록과 재생 모두에서 400으로 응답하고, 본문의 `activeSessions`에 실행 중인 id를 나열합니다. 실행 중인 세션이 없으면 요청은 마지막 전환을 따릅니다.

## 현재 상태

`GET /__control`은 다음을 반환합니다.

- `recordingsDir`: 기록이 작성되는 디렉터리.
- `mode`와 `id`: 마지막 전환에서 설정된 값.
- `redaction`: [마스킹](/ko/docs/guides/secret-redaction/) 설정. 마스킹이 꺼져 있으면 `false`. `playwrightProxy.teardown()`이 이 값을 읽어 `.har` 파일을 마스킹합니다.
- `sessions`: 지금 기록 중인 id.
