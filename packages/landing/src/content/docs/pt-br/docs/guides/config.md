---
title: Arquivo de config
description: Coloque as opções do test-proxy-recorder — alvo, porta, regexes de remoção, ritmo do WebSocket — em um arquivo de config descoberto automaticamente em vez de flags da CLI.
i18nSource: docs/guides/config.md
i18nSourceBlob: d633335aa6541254ec9f1af34ca98d1ee4b6d758
---

Para qualquer coisa além de um par de flags — especialmente regexes de remoção de corpo — coloque as opções em um arquivo de config. O proxy descobre automaticamente `test-proxy-recorder.config.{ts,js,mjs,cjs}` no diretório atual, ou passe `--config <path>` para apontar explicitamente para um. Arquivos `.ts` funcionam sem configuração adicional.

```ts
// test-proxy-recorder.config.ts
import { defineConfig } from 'test-proxy-recorder';

export default defineConfig({
  target: 'http://localhost:3002',
  port: 8100,
  recordingsDir: './e2e/recordings',
  timeout: 120_000,
  // A remoção fica ativa por padrão; este objeto a personaliza (use `redaction: false` para desativar).
  redaction: {
    headers: ['x-api-key'],         // headers extras, mesclados com os padrões
    bodyPatterns: [/sk_live_\w+/g], // literais RegExp reais — sem escaping da CLI
    allowCookies: ['theme'],        // mantenha estes cookies sem remoção
  },
  websocket: {
    timing: 'burst',                // 'burst' (padrão) ou 'original' (redosado)
  },
});
```

```bash
test-proxy-recorder                 # todas as opções vêm do arquivo de config
test-proxy-recorder --port 9000     # usa o arquivo de config, mas a porta da CLI vence
```

## Precedência

Toda opção é resolvida como **flag da CLI → arquivo de config → padrão embutido**. Uma flag passada na linha de comando sempre sobrescreve o arquivo de config; qualquer coisa que você omita recai na config e, então, no padrão. (Flags de lista como `--redact-headers` *substituem* a lista da config em vez de mesclar — passe-a apenas quando quiser sobrescrever.) O `target` pode ser fornecido como argumento da CLI ou como `target` na config; o argumento vence quando ambos estão presentes.

Veja a [referência da API](/docs/reference/api/interfaces/config/) para o tipo `Config` completo.
