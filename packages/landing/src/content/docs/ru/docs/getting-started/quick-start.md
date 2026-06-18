---
title: Быстрый старт
description: Одна команда init разворачивает test-proxy-recorder — middleware SSR для Next.js включён. Направьте ваш API на прокси, запишите один раз, воспроизводите в CI.
---

## 1. Разворот

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

Это записывает всё и не перезаписывает ничего:

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # только Next.js — middleware SSR
e2e/fixtures.ts          # запись vs воспроизведение
e2e/global-teardown.ts
package.json             # + скрипты proxy / test:e2e
```

## 2. Направьте API вашего приложения на прокси

Единственное, что `init` не может угадать: какая переменная окружения хранит базовый URL вашего API. Направьте её на прокси, когда рекордер включён, иначе — на реальный бэкенд. Прокси никогда не запускается в production:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // адрес прокси из `init`
```

## 3. Запишите один раз, воспроизводите вечно

```bash
# fixtures.ts: MODE = 'record' — захватываем реальные ответы
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — затем коммитим записи
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

Теперь CI воспроизводит ответы с выключенным бэкендом — одни и те же ответы каждый раз.

---

Настраиваете вручную или хотите подробностей? См. [ручная настройка](/ru/docs/getting-started/manual-setup/) и [как это работает](/ru/docs/getting-started/how-it-works/).
