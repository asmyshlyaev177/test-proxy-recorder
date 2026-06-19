---
title: Быстрый старт
description: Разверните test-proxy-recorder одной командой init — её лучше запускает AI-агент. Направьте ваш API на прокси, запишите один раз, воспроизводите в CI.
---

## Настройка через AI-агента (рекомендуется)

Скопируйте это и вставьте в вашего AI-кодинг-агента (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder

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
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // адрес прокси из `init`
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

Используете axios для серверных вызовов? Используйте вместо этого `registerProxyAxios(instance)`.
Записывайте против продакшен-сборки (`next build && next start`), не `next dev`.
Приложения только для браузера (SPA, расширение) могут пропустить этот шаг.

### 3. Запишите один раз, воспроизводите вечно

```bash
# fixtures.ts: MODE = 'record' — захватываем реальные ответы
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — затем коммитим записи
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

Теперь CI воспроизводит ответы с выключенным бэкендом — одни и те же ответы каждый раз.

---

Подробнее: [ручная настройка](/ru/docs/getting-started/manual-setup/) · [как это работает](/ru/docs/getting-started/how-it-works/) · [навыки AI-агента](/ru/docs/reference/ai-agent-skills/).
