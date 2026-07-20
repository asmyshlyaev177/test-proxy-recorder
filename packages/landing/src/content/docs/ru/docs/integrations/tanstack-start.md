---
title: TanStack Start
description: Помечайте серверные fetch-запросы TanStack Start заголовком сессии записи, чтобы записывать и воспроизводить SSR — через registerProxyFetch (рекомендуется) или createHeadersWithRecordingId для каждого вызова.
---

TanStack Start выполняет loaders и server functions на сервере, поэтому их вызовы `fetch` идут через прокси без контекста браузера — та же ситуация, что и с [SSR в Next.js](/ru/docs/integrations/nextjs/). Прокси определяет, какой сессии принадлежат эти запросы, по заголовку `x-test-rcrd-id`. `playwrightProxy.before()` из Playwright уже устанавливает его на навигацию браузера, запускающую SSR, поэтому id приходит во входящем серверном запросе — задача в том, чтобы **прикрепить его к исходящим серверным запросам**. (Тестам только для браузера это не нужно; прокси откатывается к глобально заданной сессии.)

:::caution[Записывайте на продакшен-сборке]
Записывайте с помощью `vite build` + `node .output/server/index.mjs` (то есть `pnpm start`), а не `vite dev`. Контекст на каждый запрос у dev-сервера отличается от продакшен-рантайма, который патчит `registerProxyFetch()`. Поскольку продакшен-сервер работает в продакшен-режиме, установите `TEST_PROXY_RECORDER_ENABLED=true` для процесса приложения на время e2e-прогона.
:::

## registerProxyFetch (рекомендуется)

Одна строка в **настройке вашего router** помечает каждый серверный `fetch` — loaders маршрутов, server functions и server routes:

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // no-op на клиенте / в продакшене, если не задан TEST_PROXY_RECORDER_ENABLED=true
```

Он патчит глобальный `fetch`, копируя `x-test-rcrd-id` текущего запроса в исходящие запросы, читая его из контекста серверного запроса TanStack Start (`getRequestHeader`). Поместите его в начало `src/router.tsx` — этот модуль выполняется на сервере для каждого SSR-запроса; вызов идемпотентен, no-op на клиенте и no-op в продакшене, если запись не включена явно.

## Для каждого вызова — createHeadersWithRecordingId

Без патчинга. Используйте для одиночного fetch внутри loader или server function, либо когда вы предпочитаете не патчить глобальный `fetch`:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

Также экспортируется `getRecordingId()`, если вы хотите получить сырой id (или `null`) и пробросить его самостоятельно. Оба читают id текущего запроса из серверного контекста, и оба являются no-op в продакшене, если не задан `TEST_PROXY_RECORDER_ENABLED=true`.

## Направьте приложение на прокси

В dev/test направьте базовые URL вашего бэкенда на прокси, чтобы записывались **оба** источника — серверная база (читается loaders / server functions, например `BACKEND_URL`) и браузерная база, встроенная в сборку (`VITE_API_URL`). В продакшене направьте их на настоящий бэкенд. Браузерные запросы обрабатываются механизмом HAR из `playwrightProxy.before()`, точно так же, как в [ручной настройке](/ru/docs/getting-started/manual-setup/).

## Приложения с аутентификацией

Рекордер [работает с вашим настоящим провайдером аутентификации](/ru/docs/getting-started/how-it-works/) (AWS Cognito, Auth0, Clerk, …) и сочетается с пометкой SSR выше. Принцип:

- **Логиньтесь по-настоящему, в режиме `transparent`.** Проект `setup` в Playwright логинится один раз со сквозным (pass-through) прокси, поэтому вход **никогда не записывается**, и сохраняет сессию (`storageState`), которую переиспользуют аутентифицированные тесты.
- **Защищённые запросы несут токен и записываются.** Каждый аутентифицированный запрос отправляет заголовок `Authorization: Bearer …`; рекордер [скрывает](/ru/docs/guides/secret-redaction/) его, поэтому ни один токен не попадает в закоммиченные записи.
- **Где хранится токен — тем и определяется механизм.** Токен в `localStorage` нельзя прочитать на сервере, поэтому защищённый fetch выполняется в браузере и записывается через HAR — без SSR-предзагрузки. Сессию на основе cookie, напротив, можно передать в loader через `createHeadersWithRecordingId()` и записать на стороне сервера.

Приложение [`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) включает запускаемый поток AWS Cognito `/login` → `/dashboard` (`e2e/setup-auth.ts` + `e2e/auth.spec.ts`), демонстрирующий ровно это.

## Полный пример

Полноценное запускаемое приложение — построенное на **TanStack Query** (предзагрузка на SSR + `useMutation`), охватывающее todos (браузер + SSR), маршрут ISR на основе заголовков кэша, случай редактирования (сокрытия секретов), WebSocket-чат и настоящий вход через AWS Cognito (аутентификация в прозрачном режиме + записанный защищённый API со скрытым токеном), всё записывается и воспроизводится — находится в [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Оно показывает, что рекордер прозрачен для вашего слоя данных: `registerProxyFetch()` помечает fetch-запросы из `queryFn` Query во время SSR, без кода, специфичного для Query.
