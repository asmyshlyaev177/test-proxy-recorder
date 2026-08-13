---
title: Навыки для ИИ-агентов
description: Установите навыки test-proxy-recorder, чтобы ИИ-агенты для кодинга (Claude Code, Cursor, Copilot) генерировали корректный код настройки.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

Если вы используете ИИ-агента для кодинга (Claude Code, Cursor, Copilot и подобные), настройте загрузку навыков, чтобы агент генерировал корректный код настройки. Навыки поставляются внутри пакета `test-proxy-recorder` через [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) и обновляются вместе с ним при обычном обновлении менеджера пакетов.

**1. Установите библиотеку** (навыки обнаруживаются среди установленных пакетов):

```bash
npm install --save-dev test-proxy-recorder
```

**2. Запишите подсказку для агента** — `install` добавляет инструкции по обнаружению навыков в конфиг вашего агента (`CLAUDE.md`, `.cursorrules` и т. п.), чтобы агент загружал подходящие навыки пакетов по запросу:

```bash
npx @tanstack/intent@latest install
```

Передайте `--map`, если предпочитаете записать в конфиг агента явные сопоставления «задача → навык» вместо общей инструкции по обнаружению.

После этого агент будет знать правильную настройку прокси/фикстуры, рабочий процесс record vs. replay и паттерны SSR-заголовков Next.js без дополнительных подсказок.

## Навыки

`test-proxy-recorder` поставляет следующие навыки:

- **`proxy-setup`** — CLI прокси, скрипты `package.json`, `webServer` в `playwright.config.ts`, фикстуры на каждый тест, режимы record/replay/transparent, маскирование секретов и жизненный цикл «записать один раз → закоммитить → воспроизвести в CI».
- **`nextjs-ssr`** — тегирование серверных fetch через `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, оговорка build-and-start вместо `next dev` и почему middleware опционален.
- **`tanstack-start`** — тегирование loader'ов, server functions и server routes в TanStack Start, оговорка build вместо `vite dev`, разделение API-URL на серверный и браузерный, SSR-предзагрузка TanStack Query и паттерн настоящей аутентификации.

Посмотрите, что доступно среди установленных пакетов, или загрузите навык напрямую:

```bash
npx @tanstack/intent@latest list                          # показать доступные навыки
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## Поддержка навыков (для контрибьюторов)

Навыки агента находятся в [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Проверяйте их периодически — и всякий раз, когда меняются API библиотеки или примеры:

```bash
npx @tanstack/intent@latest validate   # проверки структуры/формата/лимита строк (запускать перед коммитом правок навыков)
npx @tanstack/intent@latest stale      # отмечает расхождение версии с опубликованной библиотекой — пересмотрите перечисленные навыки
```

`validate` должен проходить; `stale` носит рекомендательный характер — когда он сообщает о расхождении версии после релиза, пересмотрите содержимое затронутого навыка (и поднимите его `library_version`).
