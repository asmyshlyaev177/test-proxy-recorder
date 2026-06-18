---
title: Next.js
description: Пробрасывайте заголовок сессии записи из серверных fetch в Next.js — через middleware (рекомендуется) или ручную передачу заголовков — чтобы SSR-запросы записывались и воспроизводились.
---

SSR-фреймворки вроде Next.js делают серверные вызовы `fetch`, которые проходят через прокси без контекста браузера. Прокси определяет, какой сессии принадлежат эти запросы, по заголовку `x-test-rcrd-id` — тот же заголовок, что `playwrightProxy.before()` устанавливает на `page` браузера. Этот заголовок **нужен только для SSR** — для тестов только в браузере прокси автоматически откатывается к глобально заданной сессии.

Чтобы SSR-запросы несли этот заголовок, используйте один из вариантов ниже.

## Middleware (рекомендуется)

Next.js 16 использует `proxy.ts` как точку входа middleware (экспортируемая функция называется `proxy`). Поместите его в корне проекта рядом с `next.config.ts`:

```typescript
// proxy.ts  (Next.js 16 middleware convention)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

:::note[Next.js 15 и ранее]
Точка входа — `middleware.ts`, функция называется `middleware` — всё остальное идентично:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // no-op in production
  return response;
}
```
:::

## Ручная передача заголовков

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

Полные сигнатуры хелперов `test-proxy-recorder/nextjs` см. в [справочнике API](/docs/reference/api/readme/).

## Скрипты package.json

Запускайте сервисы из скриптов, а не из `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

Полный, готовый к запуску проект находится в [примере Next.js 16](/ru/docs/reference/examples/#nextjs-16).
