---
title: Частые вопросы
description: Частые вопросы о test-proxy-recorder — параллельное воспроизведение, коммит записей в git, цель прокси для записи HAR, dev-сервер Next.js и обновление записей.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 002ae184e5041d33ef6e110d17de4e23524ea4ec
---

## Мои параллельные тесты воспроизведения иногда обращаются к реальному бэкенду — почему? {#parallel-replay}

Скорее всего, вы вызываете `playwrightProxy.teardown()` в хуке для каждого теста. Он задаёт **глобальный** режим прокси как `transparent`, а при `fullyParallel: true` каждый воркер Playwright выполняет свой собственный `test.afterAll`. Если быстрый тест завершается и вызывает `teardown()`, пока более медленный тест ещё выполняется, прокси переключается в transparent посреди теста, и оставшиеся запросы пересылаются на реальный бэкенд вместо воспроизведения.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Решение:** не используйте `test.afterAll`. Очистка сессии происходит автоматически через `context.on('close')` → `cleanupSession()`. Используйте [global teardown](https://playwright.dev/docs/test-global-setup-teardown) только если нужно сбросить прокси после всего прогона.

Второй путь, которым прогон воспроизведения попадает на реальный бэкенд, — таймаут сессии. Каждый вызов `playwrightProxy.before()` перезапускает его, а проксируемые запросы — нет. Если он истекает (по умолчанию 120000 мс) до следующего вызова `before()`, прокси переключается в `transparent`. Тогда тест, который ещё выполняется, отправляет оставшиеся запросы на реальный бэкенд. Если один тест может идти так долго, увеличьте таймаут через `--timeout` в [CLI](/ru/docs/guides/cli/) или `timeout` в [конфигурации](/ru/docs/guides/config/).

## Можно ли записывать с параллельными воркерами? {#parallel-recording}

Нет. Прокси держит только одну сессию записи одновременно. Когда второй тест начинает запись, прокси сохраняет файл первого теста и переключается на второй тест. Оставшиеся запросы первого теста через прокси после этого попадают в `.mock.json` второго теста. Записывайте с одним воркером, как уже делает скрипт `test:e2e:record`, который добавляет `init`:

```bash
npx playwright test --workers 1
```

Воспроизведение может идти с параллельными воркерами. Каждый тест воспроизводит свою сессию, а различает их заголовок `x-test-rcrd-id`: `playwrightProxy.before()` устанавливает его на запросы страницы, а `registerProxyFetch()` копирует его на серверные запросы. Именно поэтому [примеры приложений](/ru/docs/reference/examples/) записывают с `--workers 1`.

## Нужно ли коммитить записи в git?

Да. Записи должны быть в git, чтобы CI мог воспроизводить их без сети — **не** добавляйте `e2e/recordings` в `.gitignore`. Чтобы крупные файлы записей не загромождали ревью PR, пометьте их в `.gitattributes` как сгенерированные: GitHub по умолчанию сворачивает их diff'ы, но показывает их по одному клику, поэтому поле, которое переименовал API, остаётся заметным на ревью. Пометка `binary` скрыла бы такое изменение полностью.

```text
/e2e/recordings/** linguist-generated=true
```

## Важна ли `<target-url>` прокси для записи только в браузере (HAR)?

Нет. Для записи только в браузере цель не важна — процессу прокси нужно лишь работать, чтобы его эндпоинт `/__control` был доступен для управления сессиями. Цель важна только когда серверные (SSR) запросы тоже маршрутизируются через прокси.

## Что происходит с запросами браузера вне шаблона `url`? {#outside-url}

Playwright их не перехватывает, поэтому они уходят в реальную сеть — и при записи, и при воспроизведении. Для них ничего не сохраняется. Исключение — запросы к прокси (`localhost:8100`). `playwrightProxy.before()` всегда передаёт их прокси, который сам их записывает и воспроизводит.

Чтобы тест не обращался к сети, расширьте `url`, чтобы HAR охватывал этот домен, или заблокируйте домен через `page.route()` и `route.abort()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  // HAR также записывает и воспроизводит CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // Вызовы аналитики завершаются ошибкой, а не уходят в сеть.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

Подробности — в разделе [Как воспроизведение сопоставляет запросы](/ru/docs/getting-started/how-it-works/#replay-matching).

## Можно ли записывать против dev-сервера Next.js?

Для записи и воспроизведения предпочитайте `next build` + `next start`, а не `next dev`. Dev-сервер медленный и может приводить к таймаутам или нестабильным записям.

## Как обновить запись?

Снова запустите в режиме record (`RECORD_MODE=1`, скрипт `test:e2e:record`) против реального API, затем закоммитьте обновлённые файлы в `e2e/recordings/`.

## Можно ли в воспроизводимом тесте принудительно вернуть ошибку, пустой список или медленный ответ? {#override-responses}

Да, для запросов браузера. Playwright запускает обработчики маршрутов [в порядке, обратном порядку регистрации](https://playwright.dev/docs/api/class-route#route-fallback), поэтому `page.route()`, добавленный после `playwrightProxy.before()`, видит каждый запрос первым. Он может сам ответить на запрос или вызвать `route.fallback()`, чтобы передать его дальше, к записям.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Добавлен после before(), поэтому Playwright запускает этот обработчик первым.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // все остальные запросы воспроизводятся так, как были записаны
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

Для пустого списка ответьте вместо этого с `json: []`. Для медленного ответа подождите перед вызовом `route.fallback()`, например с помощью `await new Promise((resolve) => setTimeout(resolve, 3000))`. Тогда записанный ответ придёт на три секунды позже.

Серверные запросы никогда не проходят через браузер, поэтому `page.route()` не может их изменить. Для них отредактируйте запись в `.mock.json` вручную или запишите её против API в нужном вам состоянии. В файле поле `response` каждой записи содержит `statusCode`, `headers` и `body`. Если вы меняете длину тела, удалите также заголовок `content-length`.

## Можно ли использовать его, когда набор тестов проверяет развёрнутое окружение? {#deployed-environment}

Да, для запросов браузера. Playwright перехватывает их в браузере, поэтому HAR записывает и воспроизводит их без изменений в развёрнутом приложении. Направьте `url` на домен API, который вызывает браузер. Прокси всё равно должен работать рядом с тестами, потому что `playwrightProxy.before()` задаёт режим каждого теста через его эндпоинт `/__control`.

Серверные запросы делает сервер приложения, поэтому прокси в CI никогда не видит запросы, которые делает развёрнутый сервер. Чтобы записывать или воспроизводить их, запускайте сервер приложения в CI рядом с прокси. Соберите и запустите его для тестового прогона так, чтобы базовый URL API указывал на прокси и была задана `TEST_PROXY_RECORDER_ENABLED=true`. Такая настройка показана на страницах [Next.js](/ru/docs/integrations/nextjs/) и [TanStack Start](/ru/docs/integrations/tanstack-start/).
