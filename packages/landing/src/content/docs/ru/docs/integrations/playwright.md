---
title: 'Настройка Playwright: запись и воспроизведение каждого теста'
description: Записывайте и воспроизводите вызовы API в тестах Playwright с test-proxy-recorder, используя хук сессии before(), рекомендуемый global teardown и файлы записей для каждого теста.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 26b8b462ae4153046421443a751392892c37c34b
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

Вызывайте это в начале каждого теста (или в `beforeEach` / фикстуре страницы). Оно задаёт режим прокси для сессии и, если передан `url`, настраивает запись HAR для запросов на стороне браузера.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: pattern for browser-side requests to record/replay via HAR.
  //
  // Use the ACTUAL external API domain — not the proxy URL.
  // Examples:
  //   /api\.example\.com/           — your own API
  //   /x\.com/                      — record all x.com browser traffic (Chrome extension tests)
  //   /cognito-.*amazonaws\.com/    — 3rd-party auth
  url: /api\.example\.com/,
});
```

**Шаблон `url`:** совпадает с реальным внешним доменом, который вызывает браузер. В режиме record запросы идут на реальный API и сохраняются в файл `.har`. В режиме replay они отдаются из этого файла — без сети. Этот шаблон **не** указывает на прокси (`localhost:8100`).

**Исключение — full-stack приложения:** когда браузер тоже вызывает `localhost:8100` (потому что фронтенд настроен с URL прокси как базой API), используйте в качестве шаблона `/localhost:8100/`. Тогда эти запросы браузера проходят к прокси, который записывает их в `.mock.json` теста и воспроизводит оттуда, поэтому на отсутствующий запрос приходит 404 от прокси, а не прерывание HAR (см. [как воспроизведение сопоставляет запросы](/ru/docs/getting-started/how-it-works/#replay-matching)).

Имена файлов записей выводятся из имён тестов (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Global teardown (рекомендуется) {#global-teardown-recommended}

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

`teardown()` сбрасывает прокси в `transparent` и выполняет проход [маскирования](/ru/docs/guides/secret-redaction/) HAR. Не вызывайте его в хуке `afterAll` для каждого теста при `fullyParallel` — почему это ломает параллельное воспроизведение, см. в [FAQ](/ru/docs/reference/faq/#parallel-replay).

## Файлы записей

```text
e2e/recordings/
  my-test.mock.json   # server-side (proxy) — SSR fetches
  my-test.har         # client-side (HAR)   — browser fetches
```
