---
title: 'Мокирование серверных запросов в Playwright (Next.js, TanStack Start)'
description: 'Почему page.route() не видит серверные fetch в Next.js и TanStack Start и как с ними справляются в Playwright тестовый режим Next.js, MSW, mockttp или записанные ответы.'
sidebar:
  label: Мокирование на сервере
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: 6fd6662395c2237b6c951527806be5bd6116dec1
---

В приложении на Next.js или TanStack Start сервер вызывает ваш API, пока рендерит страницу. Мокирование запросов в Playwright эти вызовы никогда не видит. Разделы ниже объясняют почему, а затем сравнивают четыре способа управлять ими в тесте Playwright: тестовый режим Next.js (Next.js test mode), MSW внутри сервера, прямой прокси (forward proxy) вроде mockttp и запись реальных ответов с помощью test-proxy-recorder. Сведения о других инструментах проверены по их собственной документации и исходному коду 2026-10-03.

## Почему `page.route()` не видит серверные запросы {#why}

[`page.route()`](https://playwright.dev/docs/api/class-page#page-route) в Playwright работает с «сетевыми запросами, которые делает страница». Server Component, route loader или server function выполняются не там, а в процессе Node.js вашего приложения. Их `fetch` идёт из этого процесса прямо в API. Запрос никогда не проходит через браузер, поэтому Playwright нечего перехватывать. `page.route()` видит запрос страницы, который браузер отправляет вашему приложению, и HTML, который приходит в ответ. Запросы, которые сервер сделал, чтобы собрать этот HTML, он не видит никогда.

У файлов HAR то же ограничение, потому что [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) обслуживает «сетевые запросы, которые делаются на странице».

[Сравнение MSW с Playwright](https://mswjs.io/docs/comparison#playwright) говорит то же самое: `page.route()` влияет на «трафик в запущенном браузере, а не в процессе Node.js». [Пост команды Playwright о мокировании на сервере](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) говорит, что `page.route()` работает для запросов браузера, а «для серверных HTTP-вызовов — нет». Запрос на встроенное мокирование на сервере, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), был закрыт 2026-05-22 со ссылкой на этот пост.

## Тестовый режим Next.js {#nextjs-test-mode}

Next.js поставляет экспериментальную интеграцию с Playwright в `next/experimental/testmode/playwright`. Единственная документация к ней — [README в репозитории Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), а [руководство Next.js по Playwright](https://nextjs.org/docs/app/guides/testing/playwright) её не упоминает. Тест регистрирует обработчики через `next.onFetch()`, и Next.js отправляет им вызовы `fetch` сервера:

```typescript
// Сокращено из README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

Что для неё нужно:

- `experimental: { testProxy: true }` в `next.config.js`.
- `playwright.config.ts`, собранный через `defineConfig` из `next/experimental/testmode/playwright`, и тесты, которые импортируют `test` из того же модуля.

Под капотом каждый воркер Playwright запускает небольшой прокси-сервер. Фикстура добавляет к запросам страницы заголовок `Next-Test-Proxy-Port` (указывает на этот прокси) и заголовок `Next-Test-Data` (id теста) ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). Когда `testProxy` включён, сервер читает эти заголовки и отправляет каждый серверный `fetch` на этот прокси. Прокси передаёт запрос обработчикам этого теста ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Обработчики хранятся по id теста, поэтому параллельные тесты могут работать с одним сервером Next.js. Серверный fetch, на который не ответил ни один обработчик, выбрасывает `Proxy request aborted`. Вместо этого обработчик может вернуть `'continue'`, чтобы пропустить запрос дальше. `next.onFetch()` также получает собственные вызовы `fetch` страницы к другим источникам (origin).

Статус:

- Экспериментальный. Об этом говорят и путь импорта, и ключ конфигурации, а README называется «Experimental test mode for Playwright».
- Исправления в него всё ещё вносятся. Последнее из них, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), было влито 2026-08-13.
- README также предлагает обработчики MSW для каждого теста через `next/experimental/testmode/playwright/msw`. С MSW 3.0 (выпущен 2026-09-28) эта точка входа не загружается. Она импортирует `strict-event-emitter`, от которого MSW 3.0 больше не зависит. Кроме того, она вызывает `handleRequest()` из MSW, который в 3.0 удалён ([заметки о выпуске MSW 3.0](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). С MSW 2.15.0 она загружается. Оба результата получены на Next.js 16.3.8 и проверены 2026-10-03.

## MSW в сервере Next.js {#msw}

MSW перехватывает запросы в Node.js с помощью `setupServer` из `msw/node` ([интеграция с Node.js](https://mswjs.io/guides/integrations/node)). В его документации нет руководства по Next.js. Закрывая issue про App Router, автор MSW назвал эталоном интеграции [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) ([комментарий](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). Этот pull request открыт с 2024-01-22. Он запускает перехватчик из root layout с фиксированным списком обработчиков:

```tsx
// app/layout.tsx, из mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

Тогда обработчики живут в процессе Next.js. Пример запускает этот процесс через `webServer` из Playwright, который запускает один процесс на весь прогон ([пост команды Playwright](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Каждый воркер отправляет свои страницы на этот единственный сервер, и параллельные воркеры меняют то, как ведут себя его обработчики:

- Тест не может вызвать `server.use()` на этом сервере, потому что тест выполняется в собственном процессе воркера. У MSW нет выпущенного API для изменения обработчиков в другом процессе. Предложение — `setupRemoteServer` в [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617) — открыто с 2023-05-12. Привязка MSW к Playwright сообщает, что опирается на `page.route()`, пока это API не выйдет ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- Если вы добавите собственный канал, например API-маршрут, который вызывает `server.use()`, изменение дойдёт до каждого теста. Обработчики, добавленные через [`server.use()`](https://mswjs.io/api/setup-server/use), «сохраняются в экземпляре сервера». [Пост о server boundary](https://mswjs.io/blog/introducing-server-boundary) объясняет, что одновременные переопределения на одном сервере становятся «глобальным состоянием, общим для всех тестов». В #1617 автор MSW отмечает, что на практике вы либо держите «фиксированный список обработчиков», либо запускаете «отдельный экземпляр приложения на каждый тест».

На практике MSW внутри общего сервера Next.js отдаёт всем параллельным тестам одни и те же ответы. Два инструмента добавляют поверх MSW обработчики для каждого теста. Тестовый режим Next.js принимает обработчики MSW (с MSW 2, см. выше). [scenarist](https://github.com/citypaul/scenarist) различает сценарии по заголовку `x-scenarist-test-id`, который ваш серверный код пробрасывает в каждом `fetch` ([адаптер для Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## Прямой прокси вроде mockttp {#mockttp}

Закрывая #30766, команда Playwright [сослалась](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) на [пост](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) Simon Knott. В нём [mockttp](https://github.com/httptoolkit/mockttp), мок-сервер и прокси для HTTP и HTTPS, ставится перед исходящим трафиком сервера. Каждый тест добавляет в него правила, например `mocks.forPost(url).thenJson(200, body)`.

Код приложения не меняется. Его серверный процесс запускается с переменными окружения, которые направляют исходящие запросы через прокси:

- `HTTP_PROXY` и `HTTPS_PROXY` со значением URL прокси.
- `NODE_USE_ENV_PROXY=1`, чтобы встроенный в Node `fetch` использовал эти переменные. Node.js добавил её в 24.0.0 и 22.21.0 и отмечает, что она в активной разработке ([документация Node.js](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS` с путём к CA-сертификату прокси, чтобы сервер доверял сертификатам, которые mockttp генерирует для HTTPS-хостов.

Прокси принадлежит одному воркеру Playwright, поэтому пост запускает по серверу приложения на каждый воркер из фикстуры воркера, каждый на свободном порту. Он обходится без `webServer` из Playwright, который запускает один процесс на весь прогон ещё до того, как появится хоть один воркер. В настройке из поста запросы без правила проходят к реальному API. Пост предлагает вместо этого отвечать на них ошибкой, чтобы забытый мок стал заметен.

Команда Playwright описывает этот подход как «не зависящий от языка и фреймворка сервера». Сам пост использует простой сервер на Node, а не Next.js или TanStack Start.

## Запись реальных ответов с test-proxy-recorder {#test-proxy-recorder}

Во всех трёх вариантах выше каждый ответ вы пишете сами. test-proxy-recorder записывает то, что возвращает ваш реальный API во время локального прогона, а затем воспроизводит это в CI.

- **Прокси.** Запустите `test-proxy-recorder <target-url>` рядом с приложением на время тестового прогона. Направьте на него базовый URL API приложения, пока задана `TEST_PROXY_RECORDER_ENABLED`. Каждый прокси пересылает запросы на один бэкенд — тот `<target-url>`, с которым он был запущен.
- **`registerProxyFetch()`.** Один вызов на сервере патчит глобальный `fetch`. Он копирует заголовок `x-test-rcrd-id` текущего запроса в каждый исходящий запрос. Прокси читает этот заголовок, чтобы отнести каждый серверный вызов к его тесту. В продакшене вызов ничего не делает, если не задана `TEST_PROXY_RECORDER_ENABLED`.
- **Отдельный id для каждого теста.** `playwrightProxy.before(page, testInfo, mode)` строит id сессии из файла спецификации, названий его блоков `describe` и названия теста. Он отправляет этот id как `x-test-rcrd-id` в запросах страницы и переключает эту сессию в `record` или `replay`. Параллельные воркеры используют один сервер приложения и один прокси, и при этом каждый тест получает собственную запись.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Запишите один раз против реального API и закоммитьте файлы `.mock.json` (сервер) и `.har` (браузер). Затем CI воспроизводит их с выключенным бэкендом. При воспроизведении запрос без записи получает 404, в котором он указан. До API он никогда не доходит.

Записанные ответы охватывают только то, что API делал во время записи. Чтобы принудительно получить ошибку или крайний случай, который API не выдаёт по требованию, проще написать обработчик вручную в одном из вариантов выше.

Подробности настройки — в руководствах по [Next.js](/ru/docs/integrations/nextjs/) и [TanStack Start](/ru/docs/integrations/tanstack-start/).

## Сравнение вариантов {#comparison}

| Вариант | Настройка в приложении | Параллельные тесты | Обработчики или записанные ответы | Next.js и TanStack Start |
| --- | --- | --- | --- | --- |
| [Тестовый режим Next.js](#nextjs-test-mode) | `experimental.testProxy` в `next.config.js` | Да, обработчики хранятся отдельно для каждого теста | Обработчики (`next.onFetch()` или обработчики MSW 2) | Только Next.js |
| [MSW в сервере](#msw) | `setupServer`, запущенный в серверном коде (в примере MSW — в root layout) | Один набор обработчиков для всех тестов на этом сервере | Обработчики | Next.js: пример в открытом pull request. TanStack Start: не документировано |
| [mockttp](#mockttp) | Код не меняется. Переменные прокси и CA-сертификат для серверного процесса | Да, с отдельным сервером приложения на каждый воркер | Обработчики. Запросы без правила проходят дальше | Не документировано. Команда Playwright называет подход независимым от фреймворка |
| [test-proxy-recorder](#test-proxy-recorder) | Базовый URL API направлен на прокси во время тестов, плюс `registerProxyFetch()` | Да, с одним общим сервером приложения | Записываются с реального API | Оба документированы |

[Сравнение](/ru/docs/reference/comparison/) охватывает больше инструментов, включая Mocky Balboa, scenarist, Polly.js, talkback и proxay, а также варианты на стороне браузера.
