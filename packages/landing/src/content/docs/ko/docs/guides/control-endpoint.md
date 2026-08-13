---
title: 제어 엔드포인트
description: 프록시는 transparent, record, replay 모드 간의 프로그래밍 방식 전환을 위해 /__control을 노출합니다.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 17fac3de2790301f1ba96f8b4db21a5f01c05d79
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
  cleanup?: boolean; // true이면 모드를 전환하는 대신 세션을 정리
  websocket?: WebSocketReplayConfig; // 세션별 WebSocket 재생 페이싱 덮어쓰기
}
```

대부분의 설정에서는 이것을 직접 호출하지 않습니다. `playwrightProxy.before()`와 `setProxyMode()`([API 참조](/ko/docs/reference/api/readme/) 참조)가 대신 POST합니다. 셸, CI 단계, 또는 AI 에이전트에서 프록시를 제어할 때 `/__control`을 사용하세요.
