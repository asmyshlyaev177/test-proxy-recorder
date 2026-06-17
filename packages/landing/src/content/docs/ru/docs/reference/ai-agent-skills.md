---
title: Навыки для ИИ-агентов
description: Установите навыки test-proxy-recorder, чтобы ИИ-агенты для кодинга (Claude Code, Cursor, Copilot) генерировали корректный код настройки.
---

Если вы используете ИИ-агента для кодинга (Claude Code, Cursor, Copilot и подобные), установите навыки этой библиотеки, чтобы агент генерировал корректный код настройки:

```bash
npx @tanstack/intent@latest install
```

Это добавляет навыки `test-proxy-recorder` в ваш проект. После этого агент будет знать правильную настройку прокси/фикстуры, рабочий процесс record vs. replay и паттерны SSR-заголовков Next.js без дополнительных подсказок.

## Поддержка навыков (для контрибьюторов)

Навыки агента находятся в [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Проверяйте их периодически — и всякий раз, когда меняются API библиотеки или примеры:

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` должен проходить; `stale` носит рекомендательный характер — когда он сообщает о расхождении после релиза, пересмотрите содержимое затронутого навыка (и поднимите его `library_version`).
