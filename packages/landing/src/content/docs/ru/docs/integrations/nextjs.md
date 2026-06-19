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

## Кеширование и ISR

Не отключайте кеширование ради тестов — рекордер работает с кешируемым/ISR-роутом. Но есть одно правило, определяющее весь дизайн: **чтобы воспроизвести SSR-fetch, страница должна выполнить этот fetch в момент запроса.** Роут, отдающий пререндеренный HTML или устаревший закешированный рендер, fetch не делает, поэтому прокси нечего отдавать, и проверка видит устаревший контент.

Детерминированным остаётся такой подход: кешировать SSR-fetch на уровне fetch через `next.revalidate` + `next.tags`, а затем инвалидировать по требованию перед проверкой:

```tsx
// app/isr/page.tsx — без `export const dynamic`, без `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // Next.js 16 требует 2-й аргумент-профиль
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // жёсткая очистка
await page.goto('/isr');                     // одна навигация — детерминированно
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

`revalidateTag` для записи кеша **fetch** — это *жёсткая очистка*: следующее чтение становится промахом кеша, который блокируется и заново делает fetch через прокси. Очищать нужно до навигации воспроизведения, потому что кеш данных переживает фазы запись → воспроизведение одного процесса `next start` — иначе воспроизведение отдаст кеш фазы записи и никогда не попадёт в прокси (ложный успех).

Во время тестов пропатченный `fetch` читает `headers()`, поэтому страница рендерится динамически и реально выполняет fetch. В продакшене (рекордер выключен) `headers()` никто не читает, и страница остаётся статической ISR как обычно — динамический рендер ограничен тестами и является неотъемлемой частью записи SSR-fetch.

:::caution[Избегайте `unstable_cache` для этого]
`unstable_cache` работает по схеме *stale-while-revalidate*: `revalidateTag` помечает его запись как устаревшую, следующее чтение возвращает устаревшее значение и регенерирует в **фоне**, поэтому свежее значение приходит уже после вашей проверки — нестабильно, даже на странице `force-dynamic` и даже с прогревочным запросом. Используйте вместо этого `next.tags` на уровне fetch (жёсткую очистку).
:::

Ревалидация по требованию привилегированна (очищает кеш и форсирует регенерацию), поэтому защитите роут общим секретом — отказывайте по умолчанию, если он не задан, сравнивайте за константное время и прикрепляйте токен из теста через `use.extraHTTPHeaders` Playwright, чтобы spec никогда не работал с секретом напрямую.

Смотрите полный, готовый к запуску пример (часть [примера Next.js 16](/ru/docs/reference/examples/#nextjs-16)):

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — кешируемая страница (`next.tags` на уровне fetch)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — как защитить `revalidateTag`: отказ по умолчанию + сравнение секрета за константное время
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — инвалидируем, затем одна навигация; проверяем, что вызов ревалидации успешен
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — загружает `.env` и прикрепляет секрет через `extraHTTPHeaders`

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
