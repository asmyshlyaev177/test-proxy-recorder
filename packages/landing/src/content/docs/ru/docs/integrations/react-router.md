---
title: React Router / Remix
description: Полноценная интеграция для React Router 7 (framework mode) и Remix в дорожной карте. Пока её нет, пробрасывайте заголовок сессии записи вручную из loader'ов и action'ов.
---

:::caution[В дорожной карте]
Полноценный адаптер для React Router 7 framework mode (то, что «Remix» сегодня означает на практике) запланирован, но ещё не выпущен. Эта страница описывает ручной паттерн, работающий сегодня, и будет заменена отдельным руководством, когда адаптер появится. Нужно раньше? [Откройте issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

Loader'ы и action'ы React Router 7 выполняются на сервере, поэтому их вызовы `fetch` проходят через прокси без контекста браузера — та же ситуация, что и с [SSR Next.js](/ru/docs/integrations/nextjs/). Прокси нужен заголовок `x-test-rcrd-id` на этих серверных запросах, чтобы отнести их к правильной сессии записи.

## Ручной паттерн (работает сегодня)

Каждый loader/action получает входящий `request`. Прочитайте из него заголовок с id записи и пробросьте его в любом серверном `fetch`:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Направьте базовый URL вашего бэкенда на прокси (`http://localhost:8100`) только в dev/test, ровно как в [ручной настройке](/ru/docs/getting-started/manual-setup/). Запросы на стороне браузера по-прежнему обрабатываются механизмом HAR из `playwrightProxy.before()`.

Когда адаптер выйдет, это сведётся к одному импорту хелпера — следите за прогрессом в [дорожной карте](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
