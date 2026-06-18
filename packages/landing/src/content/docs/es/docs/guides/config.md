---
title: Archivo de configuración
description: Pon las opciones de test-proxy-recorder — destino, puerto, regex de redacción, ritmo de WebSocket — en un archivo de configuración autodetectado en vez de flags de CLI.
---

Para cualquier cosa más allá de un par de flags — especialmente las regex de redacción de cuerpo — pon las opciones en un archivo de configuración. El proxy autodetecta `test-proxy-recorder.config.{ts,js,mjs,cjs}` en el directorio actual, o pasa `--config <path>` para apuntar a uno explícitamente. Los archivos `.ts` funcionan sin más.

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

## Precedencia

Cada opción se resuelve como **flag de CLI → archivo de configuración → valor por defecto integrado**. Un flag que pasas en la línea de comandos siempre anula el archivo de configuración; lo que omitas recurre a la configuración, y luego al valor por defecto. (Los flags de lista como `--redact-headers` *reemplazan* la lista de la configuración en lugar de fusionarla — pásalo solo cuando quieras anular.) `target` puede darse como argumento de la CLI o como `target` en la configuración; el argumento gana cuando ambos están presentes.

Mira la [referencia de la API](/docs/reference/api/interfaces/config/) para el tipo `Config` completo.
