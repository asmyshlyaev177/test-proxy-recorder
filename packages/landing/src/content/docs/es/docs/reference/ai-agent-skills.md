---
title: Skills para agentes de IA
description: Instala las skills de test-proxy-recorder para que los agentes de codificación con IA (Claude Code, Cursor, Copilot) generen código de configuración correcto.
---

Si usas un agente de codificación con IA (Claude Code, Cursor, Copilot y similares), instala las skills de esta librería para que el agente genere código de configuración correcto:

```bash
npx @tanstack/intent@latest install
```

Esto añade las skills de `test-proxy-recorder` a tu proyecto. El agente entonces conocerá la configuración correcta de proxy/fixture, el flujo de grabar vs. reproducir y los patrones de cabeceras SSR de Next.js sin necesitar orientación.

## Mantener las skills (para colaboradores)

Las skills del agente viven en [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Revísalas periódicamente — y siempre que cambie la API de la librería o los ejemplos:

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` debe pasar; `stale` es orientativo — cuando reporte deriva tras una release, vuelve a revisar el contenido de la skill afectada (y sube su `library_version`).
