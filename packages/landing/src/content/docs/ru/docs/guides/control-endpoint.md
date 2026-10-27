---
title: Эндпоинт управления
description: Прокси предоставляет /__control для программного переключения режимов между transparent, record и replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

Прокси предоставляет `/__control` для программного переключения режимов.

```bash
# Get current state
curl http://localhost:8100/__control

# Switch modes
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // required unless cleanup is true
  id?: string;       // required for record/replay (and for cleanup)
  timeout?: number;  // auto-reset timeout in ms (default: 120000)
  cleanup?: boolean; // when true, save and close this id's session instead of switching mode
  websocket?: WebSocketReplayConfig; // per-session WebSocket replay pacing override
}
```

В большинстве настроек вы не вызываете это напрямую — `playwrightProxy.before()` и `setProxyMode()` (см. [справочник API](/docs/reference/api/readme/)) отправляют POST за вас. Обращайтесь к `/__control`, когда управляете прокси из shell, шага CI или ИИ-агента.

## Сессии

Прокси держит по одной сессии на каждый id теста, в режиме записи так же, как в режиме воспроизведения, поэтому тесты на параллельных воркерах делят один прокси. Каждый запрос попадает в сессию, указанную в его заголовке `x-test-rcrd-id`, а при рукопожатии WebSocket из браузера — в cookie `proxy-recording-id`. Версии до 2.0.1 включительно держали одну сессию записи на все запросы.

- **`{"mode": "record", "id": "my-test-1"}`** начинает запись этой сессии. Сессии, которые уже пишутся, продолжают запись.
- **`{"id": "my-test-1", "cleanup": true}`** действует только на эту сессию. Сессия воспроизведения закрывается. Сессия записи сохраняется в свой `.mock.json` и продолжает записывать запросы, которые её указывают, до переключения в `transparent`, так что поздний запрос из этого теста тоже сохраняется.
- **`{"mode": "transparent"}`** сохраняет и завершает все сессии, так что каждый запрос проходит насквозь к целевому серверу. Его отправляет `playwrightProxy.teardown()`. Таймер режима делает то же самое, когда истекает `timeout`, а каждое переключение перезапускает таймер.

Запрос, в котором не указана сессия, попадает в единственную запущенную сессию. Если запущено несколько сессий, прокси отвечает на него 400 и при записи, и при воспроизведении, а в теле ответа перечисляет запущенные id в `activeSessions`. Если не запущено ни одной сессии, запрос следует последнему переключению.

## Текущее состояние

`GET /__control` возвращает:

- `recordingsDir` — каталог, в который пишутся записи.
- `mode` и `id` — из последнего переключения.
- `redaction` — конфигурацию [маскирования](/ru/docs/guides/secret-redaction/) или `false`, когда маскирование выключено. `playwrightProxy.teardown()` читает её, чтобы маскировать файлы `.har`.
- `sessions` — id, которые сейчас пишутся.
