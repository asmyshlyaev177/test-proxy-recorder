---
title: TanStack Start
description: Полноценная интеграция для TanStack Start в дорожной карте. Пока её нет, пробрасывайте заголовок сессии записи вручную из server functions.
---

:::caution[В дорожной карте]
Полноценный адаптер `test-proxy-recorder/tanstack-start` запланирован, но ещё не выпущен. Эта страница описывает ручной паттерн, работающий сегодня, и будет заменена отдельным руководством, когда адаптер появится. Нужно раньше? [Откройте issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

TanStack Start выполняет loader'ы и server functions на сервере, поэтому их вызовы `fetch` проходят через прокси без контекста браузера — та же ситуация, что и с [SSR Next.js](/ru/docs/integrations/nextjs/). Прокси нужен заголовок `x-test-rcrd-id` на этих серверных запросах, чтобы отнести их к правильной сессии записи.

## Ручной паттерн (работает сегодня)

Заголовок, который `playwrightProxy.before()` устанавливает на `page` браузера, приходит во входящем запросе на сервер. Прочитайте его там и пробросьте в любом серверном `fetch`:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

Направьте базовый URL вашего бэкенда на прокси (`http://localhost:8100`) только в dev/test, ровно как в [ручной настройке](/ru/docs/getting-started/manual-setup/). Запросы на стороне браузера по-прежнему обрабатываются механизмом HAR из `playwrightProxy.before()`.

Когда адаптер выйдет, это сведётся к одному импорту хелпера — следите за прогрессом в [дорожной карте](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
