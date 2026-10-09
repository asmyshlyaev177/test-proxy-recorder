---
title: Быстрый старт
description: Разверните test-proxy-recorder одной командой init — её лучше запускает AI-агент. Направьте ваш API на прокси, запишите один раз, воспроизводите в CI.
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 2069e312fd2960771c4b3d1a68714cae12c23410
---

## Настройка через AI-агента (рекомендуется)

Скопируйте это и вставьте в вашего AI-кодинг-агента (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

Агент добавляет навыки, разворачивает всё через `init` (конфиг, фикстуру Playwright, тередаун, скрипты и — для Next.js — `registerProxyFetch()` в вашем root layout), а затем доделывает проводку, которую `init` не может угадать из промпта — `init` их распечатывает. Хотите готовый сетап для копирования? См. [примеры](/ru/docs/reference/examples/).

## Или подключите вручную

`init` записывает всё и не перезаписывает ничего:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # только Next.js — добавляет registerProxyFetch() для тегирования SSR fetch
e2e/fixtures.ts          # запись vs воспроизведение
e2e/global-teardown.ts
package.json             # + скрипты proxy / test:e2e
```

### 1. Направьте API вашего приложения на прокси

Единственное, что `init` не может угадать: какая переменная окружения хранит базовый URL вашего API. Направьте её на прокси, когда рекордер включён, на реальный бэкенд в остальных случаях — прокси никогда не запускается в продакшене:

```ts
// TEST_PROXY_RECORDER_ENABLED имеет значение 'true' или '1' только во время e2e-прогона.
const recorderEnv = process.env.TEST_PROXY_RECORDER_ENABLED ?? '';
const API_BASE = ['true', '1'].includes(recorderEnv)
  ? 'http://localhost:8100' // адрес прокси из `init`
  : 'https://api.example.com';
```

### 2. Тегируйте серверные fetch (только Next.js)

Браузерные запросы уже несут id сессии записи (Playwright устанавливает его). Для серверных fetch (SSR, Server Components) добавьте одну строку в ваш root layout, чтобы они тоже тегировались — `init` делает это за вас:

```tsx
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

Используете axios для серверных вызовов? Используйте вместо этого `registerProxyAxios(instance)`. Записывайте против продакшен-сборки (`next build && next start`), не `next dev`. Приложения только для браузера (SPA, расширение) могут пропустить этот шаг.

### 3. Запишите один раз, воспроизводите вечно

Тесты работают с вашим dev-бэкендом и его базой данных. Скрипты `test:e2e` тестируют продакшен-сборку приложения, если `init` её нашёл (скрипт `preview` или `start` в Next.js), а обычный `npx playwright test` или `--ui` использует ваш dev-сервер, поэтому упавший тест можно перезапустить вручную и повторить ошибку в браузере. Перед записью запустите `dev` и приведите dev-базу данных в состояние, которого ожидают тесты, с помощью собственного seed-скрипта.

```bash
# Задаёт RECORD_MODE=1 — захватываем реальные ответы
npm run test:e2e:record

# Затем коммитим записи; npm run test:e2e воспроизводит их
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

Теперь CI воспроизводит ответы с выключенным бэкендом — одни и те же ответы каждый раз.

---

Подробнее: [ручная настройка](/ru/docs/getting-started/manual-setup/) · [как это работает](/ru/docs/getting-started/how-it-works/) · [навыки AI-агента](/ru/docs/reference/ai-agent-skills/).
