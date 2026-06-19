---
title: Ручная настройка
description: Подключите test-proxy-recorder вручную в full-stack (SSR + браузер) приложение или в SPA/расширение только для браузера, затем запишите один раз и воспроизводите в CI.
---

Большинство людей должно запустить [`init`](/ru/docs/getting-started/quick-start/) — он записывает все файлы ниже за вас. Эта страница — справочник того, что генерирует `init`, чтобы вы могли подключить всё вручную, убрать codegen или понимать каждую часть.

## Full-stack (SSR + браузер)

Для Next.js и аналогичных фреймворков, где и сервер, и браузер делают вызовы API. Используйте оба механизма записи вместе — см. [как это работает](/ru/docs/getting-started/how-it-works/).

Прокси — это лёгкий процесс, который вы запускаете **вместе с вашим приложением для тест-прогона** (через скрипт, как ниже, или через `webServer` Playwright) — это не инфраструктура, которую вы деплоите или поддерживаете. Весь сетап: запустите его рядом с приложением, направьте базовый URL API вашего приложения на него, пробросьте заголовок сессии из SSR и напишите одну фикстуру.

### 1. Добавьте скрипты в `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

В коде приложения направьте базовый URL API на прокси, когда recorder включён, и на реальный бэкенд в остальных случаях — прокси никогда не запускается в продакшене:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // адрес прокси
```

`TEST_PROXY_RECORDER_ENABLED` устанавливается скриптами `dev:proxy` / `serve:proxy` выше, а также скриптами, сгенерированными `init`. Используйте ту переменную окружения, которую ваше приложение уже использует для базового URL API (например `API_URL`, `NEXT_PUBLIC_API_URL`) — то же условие применяется.

:::note[Next.js]
Предпочитайте `build` + `serve`, а не `dev` для записи и воспроизведения тестов. Dev-сервер Next.js медленный и может приводить к таймаутам или нестабильным записям.
:::

### 2. Тегируйте серверные fetch (Next.js)

Серверные вызовы `fetch` нуждаются в заголовке recording-session, чтобы прокси знал, какому тесту они принадлежат. Playwright уже устанавливает его на навигацию браузера, поэтому id находится в `next/headers` — вам нужно лишь прикрепить его к исходящим SSR-запросам. Добавьте одну строку в ваш root layout (`init` делает это за вас):

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Это работает на Node **и** Edge-runtime. Для axios-приложений вызовите `registerProxyAxios(instance)` на каждом серверном инстансе; для одиночного fetch `createHeadersWithRecordingId(await headers())` — альтернатива без патча. `proxy.ts`/`middleware.ts` с `setNextProxyHeaders` **опциональны** — они только расскрывают id, они не тегируют fetch. **Записывайте против продакшен-сборки** (`next build && next start`), не `next dev`. См. [интеграцию Next.js](/ru/docs/integrations/nextjs/) для подробностей. Приложения только для браузера могут пропустить этот шаг.

### 3. Напишите тест

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR requests (server → proxy) are recorded to .mock.json.
// Browser requests to the proxy URL are also covered.
const CLIENT_SIDE_URL = /localhost:8100/;

// Change to 'record' to update recordings.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Запишите

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 5. Переключитесь на воспроизведение и закоммитьте

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Только браузер / SPA / расширение

Когда все вызовы API идут из браузера (без SSR), вам нужен только механизм HAR. Для самой записи бэкенд прокси не требуется — процесс прокси лишь обеспечивает управление сессиями.

### 1. Установите

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Добавьте прокси в `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

Цель прокси (`https://api.example.com`) не важна для записи только в браузере — она используется только если серверные (SSR) запросы тоже нужно проксировать. Процесс прокси должен быть запущен, чтобы его эндпоинт `/__control` был доступен для управления сессиями.

### 3. Напишите фикстуру

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Match the external API domain your browser makes requests to.
// In record mode these requests go to the real API and are saved.
// In replay mode they are served from disk — no network needed.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. Напишите тест

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Запишите — выполните один раз против реального API

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. Переключитесь на воспроизведение и закоммитьте

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

Теперь CI выполняется без какого-либо доступа к сети.

:::caution
**Не** добавляйте `e2e/recordings` в `.gitignore`. Записи должны быть в git для воспроизведения в CI.
:::

Добавьте это в `.gitattributes`, чтобы сворачивать крупные файлы записей в diff'ах PR:

```text
/e2e/recordings/** binary
```
