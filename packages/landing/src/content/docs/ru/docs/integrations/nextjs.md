---
title: Next.js
description: Тегируйте серверные fetch в Next.js заголовком recording-session, чтобы SSR записывался и воспроизводился — через registerProxyFetch (рекомендуется, любой runtime), registerProxyAxios для axios или createHeadersWithRecordingId на каждый вызов. Middleware опционален.
---

SSR-фреймворки вроде Next.js делают серверные вызовы `fetch`, которые проходят через прокси без контекста браузера. Прокси определяет, какой сессии принадлежат эти запросы, по заголовку `x-test-rcrd-id`. `playwrightProxy.before()` Playwright уже устанавливает его на навигацию браузера, которая трегерит SSR, поэтому id доступен в `next/headers` — задача в том, чтобы **прикрепить его к исходящим серверным запросам**. (Тестам только в браузере всё это не нужно; прокси откатывается к глобально заданной сессии.)

:::tip
[`test-proxy-recorder init`](/ru/docs/getting-started/quick-start/) детектит Next.js и подключает рекомендованный ниже подход в ваш root layout автоматически.
:::

:::caution[Записывайте против продакшен-сборки]
Записывайте через `next build && next start`, не `next dev`. Dev-сервер может сбрасывать патч глобального `fetch` между запросами ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)), а также он медленнее/нестабильнее. Поскольку `next start` запускается в режиме продакшена, выставьте `TEST_PROXY_RECORDER_ENABLED=true` на процессе приложения для вашего e2e-прогона.
:::

## registerProxyFetch (рекомендуется)

Одна строка в вашем **root layout** тегирует каждый серверный `fetch` — Server Components, Route Handlers, на Node **и** Edge-runtime:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true
```

Он патчит глобальный `fetch`, чтобы копировать `x-test-rcrd-id` текущего запроса на исходящие запросы, чтобы прокси мог различать конкурентные сессии воспроизведения. Вызывайте его из root layout — **не** из `instrumentation.ts`, чей контекст отличается от того, который рендерит ваши роуты на Edge-runtime, поэтому патч там тихо никогда не срабатывает.

## axios — registerProxyAxios

Если ваши серверные запросы идут через axios, зарегистрируйте каждый серверный инстанс один раз:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

Он добавляет request-перехватчик, который штампует id (не трогая глобальный `fetch`), поэтому он неуязвим к приведённой выше dev-серверной проблеме. No-op в продакшене / в браузере; идемпотентен на инстанс; никогда не перезаписывает id, заданный вызывающим.

## На каждый вызов — createHeadersWithRecordingId

Без патча, и работает под `next dev` тоже. Используйте для одиночного fetch или когда не хочется патчить глобальный `fetch`:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (опционален)

`proxy.ts` (Next.js 16+, экспортируемый `proxy`) или `middleware.ts` (15 и ранее, экспортируемый `middleware`) с вызовом `setNextProxyHeaders` делает id доступным через `next/headers`, но **не тегирует исходящие fetch** — поэтому он не требуется, когда вы используете один из хелперов выше. Обращайтесь к нему только если у вас уже есть middleware (auth и пр.), и всё равно комбинируйте его с хелпером для тегирования:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // exposes the id; pair with a helper above
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Полные сигнатуры хелперов `test-proxy-recorder/nextjs` см. в [справочнике API](/ru/docs/reference/api/readme/). Полный, готовый к запуску Edge-проект находится в [примере Edge-runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

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
