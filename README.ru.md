<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · Русский · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=ru source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **VCR для Playwright** — записывайте реальные ответы API один раз и детерминированно воспроизводите их в CI. Поддерживает SSR Next.js и TanStack Start, браузер и WebSocket-трафик. Без бэкенда, без моков, написанных вручную.

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Запись реальных ответов API, затем их воспроизведение в CI с выключенным бэкендом" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## Зачем

У каждого нестабильного e2e-прогона одна и та же первопричина: сеть. Этот инструмент один раз записывает реальный трафик, а затем воспроизводит его байт-в-байт в CI — поэтому тесты проходят с выключенным бэкендом.

- **Без бэкенда в CI** — воспроизведение с диска, без сети.
- **Без ручных моков** — захватывайте реальные взаимодействия и никогда не пишите фикстуры вручную.
- **SSR + браузер + WebSocket** — записывайте там, откуда исходят запросы.

## Сравнение

test-proxy-recorder — единственный, кто записывает **реальный** трафик через SSR, браузер и WebSocket без моков, написанных вручную, — именно эту нишу остальные оставляют незакрытой.

| Возможность | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Запись реального трафика | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Серверная сторона (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Сторона браузера | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Нативно для Playwright | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Поддерживается | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js перехватывает HTTP в Node, поэтому мокинг SSR возможен внутри процесса приложения, но не как часть прогона Playwright. MSW и Mocky Balboa тоже воспроизводят реальные ответы — но моки вы пишете вручную, а не записываете.

См. [полное сравнение в документации](https://test-proxy-recorder.dev/docs/#comparison) — в том числе когда стоит выбрать что-то другое.

## Быстрый старт

**Самый быстрый путь — отдайте это вашему AI-кодинг-агенту.** Скопируйте это, подставьте URL вашего бэкенда и вставьте в Claude Code / Cursor / и т. д. (он запустит `init` и доделает проводку):

```text
# Настройте test-proxy-recorder для end-to-end-тестов в этом проекте, затем следуйте инструкциям, которые печатает `init`. Выполните эти команды:
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# Затем выполните шаги, которые печатает init: направьте базовый URL API вашего приложения на прокси только в dev/test, тегируйте серверные fetch (Next.js), добавьте smoke-тест и проверьте record → replay.
```

Предпочитаете подключить вручную:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` неразрушающе разворачивает всё: конфиг прокси, фикстуру Playwright, глобальный тередаун, скрипты `package.json` и (для Next.js) тегирование SSR-fetch в вашем root layout через `registerProxyFetch()`. В конце он печатает готовый промпт для AI-агента с шагами, специфичными для приложения, которые он не может угадать.

Единственное, что `init` не может угадать, — какая переменная окружения хранит базовый URL вашего API. Направьте её на прокси, когда рекордер включён, на реальный бэкенд в остальных случаях — прокси никогда не запускается в продакшене:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // адрес прокси из `init`
```

Затем задайте `MODE = 'record'`, запустите один раз против реального API, переключите на `'replay'` и закоммитьте `e2e/recordings/`. Теперь CI работает с выключенным бэкендом.

Полный разбор: [быстрый старт](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [ручная настройка](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **Только что это сэкономило вам полдня написания моков вручную?**
> [⭐ на GitHub](https://github.com/asmyshlyaev177/test-proxy-recorder) занимает одну секунду — именно так следующий человек, воюющий с нестабильными e2e-тестами, найдёт этот проект. Я соло-мейнтейнер и читаю каждую звезду как сигнал продолжать.

## Примеры

Полностью рабочие приложения в [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), каждое со своим README:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + браузер + WebSocket-чат
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — `registerProxyFetch` для конкурентного воспроизведения
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + браузер, TanStack Query, ISR, WebSocket и настоящий вход через Cognito
- [Расширение Chrome](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — только браузер, воспроизводится офлайн
- [Крипто-тикер](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — сторонний WebSocket-фид
- [Аутентифицированное приложение](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — настоящий вход через Cognito, защищённый API воспроизводится

## Документация

Всё остальное — на [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/): [как это работает](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [конфигурация](https://test-proxy-recorder.dev/docs/guides/config/), [маскирование секретов](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [интеграция с Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [интеграция с TanStack Start](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [справочник API](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

Используете AI-кодинг-агента? `npx @tanstack/intent@latest install` добавит навыки, чтобы он генерировал корректный код настройки. См. [руководство по навыкам для AI-агентов](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Требования

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (peer-зависимость)

## Обратная связь и участие

Этот проект создаётся и поддерживается в открытую одним человеком, и каждый отзыв определяет, что будет дальше:

- **[⭐ Поставьте звезду репозиторию](https://github.com/asmyshlyaev177/test-proxy-recorder)** — самый быстрый способ поддержать проект, и это реально помогает другим его найти.
- **Наткнулись на шероховатость или есть идея?** [Создайте issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) или напишите в [Discord](https://discord.gg/w7rgYbY5zz) — даже однострочное «это меня запутало» на вес золота.
- **Хотите поучаствовать?** PR приветствуются.

## Навыки для ИИ

Используете AI-кодинг-агента (Claude Code, Cursor, Copilot, …)? Библиотека поставляет навыки [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent), чтобы агент генерировал корректный код настройки. Установите пакет, затем запишите подсказку для агента:

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` добавляет инструкцию по обнаружению навыков в конфиг вашего агента (`CLAUDE.md`, `.cursorrules`, …); агент загружает навыки `proxy-setup`, `nextjs-ssr` и `tanstack-start` по запросу. Посмотрите их список или загрузите напрямую через `npx @tanstack/intent@latest list` и `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`. Полное руководство: [навыки для AI-агентов](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

Исходники навыков находятся в [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/).

## Наймите меня

Я — **Aleksandr Smyshliaev**, автор и мейнтейнер этого инструмента. Senior
frontend-инженер (React / Next.js / TypeScript, 8+ лет), **прямо сейчас доступен
для полной удалённой занятости**.

Этот проект существует, потому что я годами чинил чужие нестабильные тестовые
наборы. Это именно та работа, в которой я силён: скучная инфраструктура, которая
определяет, приятно ли работать с кодовой базой через полгода.

- **Сильные стороны** — библиотеки компонентов, управление состоянием и тестовые
  наборы, которые переживают рефакторинг.
- **Также моё** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (~84k установок в неделю),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (типизированное
  состояние в URL), [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **Где** — Тбилиси, Грузия (GMT+4), полное пересечение с CET. Зарегистрированное
  юрлицо подрядчика, поэтому для B2B-сотрудничества не нужен employer-of-record.
- **Связаться со мной** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## Лицензия

MIT
