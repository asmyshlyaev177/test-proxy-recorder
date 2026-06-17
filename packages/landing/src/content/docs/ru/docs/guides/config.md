---
title: Файл конфигурации
description: Поместите опции test-proxy-recorder — цель, порт, регулярные выражения для редактирования, темп WebSocket — в автоматически обнаруживаемый файл конфигурации вместо флагов CLI.
---

Для всего, что выходит за рамки пары флагов — особенно регулярных выражений для редактирования тела — поместите опции в файл конфигурации. Прокси автоматически обнаруживает `test-proxy-recorder.config.{ts,js,mjs,cjs}` в текущем каталоге, либо передайте `--config <path>`, чтобы указать его явно. Файлы `.ts` работают из коробки.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // Redaction is on by default; this object customizes it (use `redaction: false` to disable).
  redaction: {
    headers: ['x-api-key'],         // extra headers, merged with the defaults
    bodyPatterns: [/sk_live_\w+/g], // real RegExp literals — no CLI escaping
    allowCookies: ['theme'],        // keep these cookies unredacted
  },
  websocket: {
    timing: 'burst',                // 'burst' (default) or 'original' (re-paced)
  },
});
```

```bash
test-proxy-recorder                 # all options from the config file
test-proxy-recorder --port 9000     # config file, but CLI port wins
```

## Приоритет

Каждая опция разрешается так: **флаг CLI → файл конфигурации → встроенное значение по умолчанию**. Флаг, переданный в командной строке, всегда переопределяет файл конфигурации; то, что вы опустили, откатывается к конфигурации, затем к значению по умолчанию. (Списковые флаги вроде `--redact-headers` *заменяют* список из конфигурации, а не объединяют его — передавайте их только когда хотите переопределить.) `target` можно задать как аргумент CLI или как `target` в конфигурации; при наличии обоих побеждает аргумент.

Полный тип `Config` см. в [справочнике API](/docs/reference/api/interfaces/config/).
