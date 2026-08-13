---
title: Примеры приложений
description: Полностью рабочие примеры test-proxy-recorder — SSR Next.js и TanStack Start, расширение Chrome, сторонний WebSocket-тикер и аутентифицированное приложение, воспроизводимое без бэкенда.
i18nSource: docs/reference/examples.md
i18nSourceBlob: d58a37f3eb41cbc0c0319b630b35da2930081ea1
---

Полностью рабочие примеры находятся в [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — по одному на каждый механизм записи. У каждого свой README с полной настройкой и рабочим процессом записи/воспроизведения.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — приложение списка задач на Next.js 16 с мок-бэкендом, прокси и e2e-тестами Playwright. Записывает и SSR-фетчи (`.mock.json`), и браузерные фетчи (`.har`), а также включает WebSocket-чат против локального бэкенда. См. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

## Next.js Edge runtime {#nextjs-edge}

[`apps/example-nextjs-edge`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — приложение на Next.js 16, чья страница рендерится на **Edge runtime** (`export const runtime = 'edge'`). Его SSR-`fetch` тегируется id сессии записи через `registerProxyFetch()` (вызывается из root layout), поэтому конкурентные сессии воспроизведения остаются разными там, куда `instrumentation.ts` не достаёт. См. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs-edge/README.md).

## TanStack Start {#tanstack-start}

[`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — приложение на TanStack Start (Vite + Nitro), построенное на **TanStack Query**. Записывает и SSR-запросы (`.mock.json`, помеченные через `registerProxyFetch()` в `src/router.tsx`), и браузерные запросы (`.har`), охватывая живой список todo, маршрут ISR на основе заголовков кэша, WebSocket-чат и настоящий вход через **AWS Cognito** (аутентификация в прозрачном режиме + защищённый API со скрытым токеном). См. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-tanstack-start/README.md).

## Расширение Chrome {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — настоящее расширение Chrome, которое вызывает API X/Twitter из content script; браузерные запросы записываются в `.har` и воспроизводятся офлайн, без живого API и аккаунта в CI. См. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

## Крипто-тикер — сторонний WebSocket {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — живой тикер цены BTC-USD на основе публичного WebSocket-фида Binance. Записывает реальный фид один раз через прокси, затем воспроизводит детерминированные цены в CI без сети и аккаунта на бирже. См. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

## Аутентифицированное приложение {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — приложение на Next.js, которое входит в **реальный пул пользователей AWS Cognito**, затем записывает/воспроизводит свой защищённый API. Вход остаётся живым при каждом прогоне (никогда не записывается); защищённые данные воспроизводятся с выключенным бэкендом, а токен аутентификации вырезается из записей. Интеграция — это лишь несколько файлов; см. его [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md). Тот же паттерн **без облачного аккаунта** см. в [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
