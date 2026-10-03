---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js и тестовый режим Next.js'
description: 'Сравнение test-proxy-recorder с MSW, routeFromHAR, Polly.js, тестовым режимом Next.js, mockttp, Mocky Balboa, scenarist, talkback и proxay, с источниками.'
sidebar:
  label: Сравнение
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

Каждый инструмент здесь управляет ответами API, которые видит end-to-end-тест. Они различаются тем, где перехватывают запросы (в браузере, внутри вашего сервера или в отдельном прокси), и тем, пишете ли вы ответы сами или записываете их. Таблица сохраняет шесть инструментов из [обзора документации](/ru/docs/#comparison) и добавляет тестовый режим Next.js (Next.js test mode), mockttp, scenarist, talkback и proxay. Каждая ячейка взята из собственной документации, README или исходного кода инструмента (ссылки под таблицей) по состоянию на 2026-10-03. «Не документировано» означает, что эти источники об этом не говорят.

## Таблица возможностей {#table}

| Инструмент | Запись реального трафика | Серверная сторона (SSR) | Сторона браузера | WebSocket | Нативно для Playwright | Последний выпуск |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Да | Да, через прокси | Да, через HAR | Да | Да | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Да | Нет | Да | Нет | Встроен | Playwright 1.63.0, 2026-09-04 |
| MSW | Нет (обработчики или HAR через `@msw/source`) | Внутри серверного процесса | Да | Да | `@msw/playwright`, запросы браузера | 3.0.2, 2026-10-03 |
| Polly.js | Да | Внутри серверного процесса | Да | Не документировано | Сторонний адаптер | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Да | Нет | Да | Не документировано | Да | 0.3.0, 2026-05-12 |
| Mocky Balboa | Нет (обработчики) | Да | Да | Не документировано | Да | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Тестовый режим Next.js | Нет (обработчики) | Да, только Next.js | Запросы к другим источникам (origin) | Не документировано | Да | Экспериментальный, в Next.js 16.3.8, 2026-09-30 |
| mockttp | Не документировано | Да, как прямой прокси (forward proxy) | Да, как прокси браузера | Да | Нет, фикстуру пишете вы | 4.6.3, 2026-09-11 |
| scenarist | Нет (сценарии в коде) | Next.js и Express | Нет | Не документировано | Да | 0.5.1, 2026-09-27 |
| talkback | Да | Да, как адрес API | Не документировано | Не документировано | Нет | 4.2.0, 2024-07-10 |
| proxay | Да | Да, как адрес API | Да, как адрес API | Не документировано | Нет | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## Источники и примечания {#sources}

Даты выпусков взяты из реестра npm, если не указана ссылка на релиз GitHub.

- **test-proxy-recorder.** Серверные вызовы идут через прокси, а вызовы из браузера — через HAR ([как это работает](/ru/docs/getting-started/how-it-works/)). Записанные сообщения WebSocket воспроизводит прокси ([CLI](/ru/docs/guides/cli/#websocket-replay-pacing)). Выпуск: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** С `update: true` он записывает HAR из реального трафика ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). Воспроизведение обслуживает «сетевые запросы, которые делаются на странице» ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). Оно идёт через обработчики `route()`, которые отвечают на HTTP-запросы, и пути для WebSocket у него нет ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Выпуск: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** Обработчики запросов пишете вы. Сам MSW ничего не записывает, но [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) умеет генерировать обработчики из файла HAR, который вы экспортируете из DevTools браузера. В Node.js он работает внутри процесса, который делает запросы ([`setupServer`](https://mswjs.io/guides/integrations/node)). Для WebSocket используется [API `ws`](https://mswjs.io/docs/websocket). Официальная привязка [`@msw/playwright`](https://github.com/mswjs/playwright) работает через `page.route()`, поэтому охватывает запросы браузера. Выпуск: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** Его [репозиторий](https://github.com/Netflix/pollyjs) описывает его как «запись, воспроизведение и заглушки HTTP-взаимодействий». [Адаптер node-http](https://netflix.github.io/pollyjs/#/adapters/node-http) патчит модули `http` и `https` в Node, а [адаптер fetch](https://netflix.github.io/pollyjs/#/adapters/fetch) оборачивает глобальный `fetch`. Поэтому Polly записывает внутри того процесса, в котором запущен. В его документации нет адаптера для WebSocket. Поддержку Playwright даёт сторонний [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), на который ссылается [документация Polly](https://netflix.github.io/pollyjs/#/adapters/playwright). Выпуск: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** Его [README](https://github.com/vitalets/playwright-network-cache) говорит, что он ускоряет тесты Playwright «за счёт кеширования сетевых запросов в файловой системе». `CacheRoute` перехватывает через `page.route()` ([исходный код](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), поэтому видит только запросы браузера. Выпуск: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** Моки вы определяете в тесте — для серверных и клиентских запросов через один API. Моки остаются изолированными для каждого теста, пока тесты идут параллельно ([возможности](https://docs.mockybalboa.com/docs/features/)). Для Next.js 14 и новее его CLI запускает ваш сервер Next.js ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). Его документация упоминает WebSocket только как канал между вашим сервером и тест-раннером. Выпуск: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Тестовый режим Next.js.** Обработчики, зарегистрированные через `next.onFetch()`, получают вызовы `fetch` сервера, а также вызовы `fetch` страницы к другим источникам ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). Его настройка, статус и MSW 3 разобраны в разделе [Мокирование на сервере](/ru/docs/guides/server-side-mocking/#nextjs-test-mode). Выпуск: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** Мок-сервер и прокси для HTTP и HTTPS для тестов, которые выполняются «в Node или в браузерах» ([README](https://github.com/httptoolkit/mockttp)). `forAnyWebSocket()` мокает WebSocket-соединения ([исходный код](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). README не описывает режима записи. [Пост](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) команды Playwright показывает, какую фикстуру написать. Выпуск: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** [README](https://github.com/citypaul/scenarist) говорит, что он «построен на MSW, с управлением сценариями во время выполнения и изоляцией по ID теста», а сценарии вы пишете в коде. Его FAQ говорит, что он «обеспечивает управление сценариями на стороне сервера, которое дополняет клиентское мокирование Playwright». Ваш серверный код пробрасывает `x-scenarist-test-id` в каждом `fetch` ([адаптер для Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), а `@scenarist/playwright-helpers` предоставляет фикстуру Playwright. Выпуск: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** «HTTP-прокси на JavaScript, который записывает и воспроизводит HTTP-запросы» ([README](https://github.com/ijpiantanida/talkback)). Ваше приложение отправляет свои запросы в talkback. Запрос, который совпадает с сохранённой кассетой (tape), получает ответ из неё, а неизвестный пересылается на хост и сохраняется как новая кассета. README не упоминает ни браузеры, ни отдельные кассеты для каждого теста. Выпуск: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** Прокси для записи и воспроизведения в связке «веб-фронтенд и его бэкенд» или «сервер и другой сервер» ([README](https://github.com/airtasker/proxay)). Тесты выбирают кассету через `POST /__proxay/tape`, например в `beforeEach`, а параллельные тесты README не рассматривает. Версия 2.0.0 — это [релиз на GitHub](https://github.com/airtasker/proxay/releases/tag/v2.0.0); [npm](https://www.npmjs.com/package/proxay) по-прежнему отдаёт 1.9.0.

## Альтернатива Polly.js для Playwright {#pollyjs}

Polly.js от Netflix записывает, воспроизводит и подменяет заглушками HTTP-запросы, и именно он вдохновил test-proxy-recorder. Его состояние на 2026-10-03:

- У `@pollyjs/core` не было выпусков после 6.0.6 от 2023-07-20. Последнее изменение в репозитории, 2025-05-31, опубликовало `@pollyjs/adapter-fetch` 6.0.7, который снял с адаптера fetch пометку deprecated для Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- Собственного адаптера для Playwright у Polly нет. Его документация указывает на сторонний [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), который подключается к контексту браузера или странице. Его последний выпуск, 2.4.0, вышел 2024-04-18.
- Для серверных вызовов Polly должен работать внутри серверного процесса через свой адаптер node-http или fetch.

Если вы переходите с Polly.js, его понятия соотносятся с понятиями test-proxy-recorder следующим образом.

| Polly.js | test-proxy-recorder |
| --- | --- |
| Режимы `record`, `replay` и `passthrough` ([конфигурация](https://netflix.github.io/pollyjs/#/configuration)) | Режимы `record`, `replay` и `transparent`, которые для каждого теста задаёт `playwrightProxy.before()` |
| Именованная запись на каждый экземпляр Polly, которую сохраняет persister | `.mock.json` (сервер) и `.har` (браузер) на каждый тест Playwright в каталоге записей |
| Адаптеры внутри процесса, который делает запросы | Процесс прокси для серверных вызовов, HAR для вызовов из браузера и `registerProxyFetch()` на сервере |
| По умолчанию запросы сопоставляются по методу, заголовкам, телу, порядку и URL | Серверные запросы сопоставляются по методу, пути и хешу строки запроса в порядке записи, тела не сравниваются. Запросы браузера следуют правилам HAR в Playwright, которые сравнивают ещё и тела POST |

## MSW с Next.js и Playwright {#msw}

В приложении Next.js запросам браузера и серверным запросам нужны разные настройки MSW.

- **Запросы браузера.** [`@msw/playwright`](https://github.com/mswjs/playwright), официальная привязка, запускает ваши обработчики через `page.route()`, с фикстурой `network`, которую можно менять в каждом тесте.
- **Серверные запросы.** MSW работает внутри процесса Next.js. В документации MSW нет руководства по Next.js, а эталонный пример — открытый pull request [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Обработчики, которые вы меняете во время выполнения, общие для всех тестов, которые обращаются к этому серверу. Подробности и источники — в разделе [Мокирование на сервере](/ru/docs/guides/server-side-mocking/#msw).
- **Серверные обработчики для каждого теста.** Тестовый режим Next.js принимает обработчики MSW для каждого теста, но его точка входа для MSW не загружается с MSW 3.0 ([подробности](/ru/docs/guides/server-side-mocking/#nextjs-test-mode)). scenarist строит сценарии для каждого теста на MSW для Next.js и Express, а ваш серверный код пробрасывает заголовок с id теста в каждом `fetch`.
- **Запись.** MSW не записывает трафик. [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) превращает в обработчики файл HAR, экспортированный из DevTools браузера.

test-proxy-recorder выбирает обратный компромисс. Он записывает обе стороны с реального API, поэтому писать обработчики не нужно. Взамен у вас меньше контроля над ответами, которые API не выдаёт по требованию.

## Когда выбрать что-то другое {#when-to-use-something-else}

- **Весь ваш трафик идёт на стороне браузера.** Встроенному в Playwright `routeFromHAR` не нужны дополнительные зависимости. Начните с него и добавьте test-proxy-recorder, когда появятся серверные запросы.
- **Вы хотите писать ответы вручную или принудительно вызывать ошибки и крайние случаи.** Для этого лучше подходят обработчики MSW, к тому же MSW работает в [Vitest](https://mswjs.io/guides/integrations/vitest), [Storybook](https://mswjs.io/guides/integrations/storybook) и [в браузере](https://mswjs.io/guides/integrations/browser), а не только в Playwright. Для серверных обработчиков на каждый тест в Playwright посмотрите на Mocky Balboa, scenarist или тестовый режим Next.js.
- **Вам нужно только кеширование на стороне браузера с минимальной настройкой.** [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) кеширует ответы на диске через одну фикстуру.
- **Ваш сервер написан не на JavaScript, или вы не можете менять его код.** Прямой прокси вроде mockttp работает через `HTTPS_PROXY`. [Пост](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) команды Playwright говорит, что Python, Go, Ruby, Rust и .NET работают так же, а для Java нужны `-Dhttps.proxyHost` и `-Dhttps.proxyPort`.
- **Вам нужны запись и воспроизведение вне Playwright, на любом языке.** proxay и talkback — самостоятельные HTTP-серверы, которые сохраняют записи в виде файлов кассет.
