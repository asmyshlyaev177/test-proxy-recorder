---
title: Skills para agentes de IA
description: Instala las skills de test-proxy-recorder para que los agentes de codificación con IA (Claude Code, Cursor, Copilot) generen código de configuración correcto.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

Si usas un agente de codificación con IA (Claude Code, Cursor, Copilot y similares), configura la carga de skills para que el agente genere código de configuración correcto. Las skills se distribuyen dentro del paquete `test-proxy-recorder` vía [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) y viajan con él a través de las actualizaciones normales de tu gestor de paquetes.

**1. Instala la librería** (las skills se descubren a partir de los paquetes instalados):

```bash
npm install --save-dev test-proxy-recorder
```

**2. Escribe la guía del agente** — `install` añade instrucciones de descubrimiento a tu config de agente (`CLAUDE.md`, `.cursorrules`, etc.) para que el agente cargue bajo demanda las skills del paquete que correspondan:

```bash
npx @tanstack/intent@latest install
```

Pasa `--map` si prefieres escribir asignaciones explícitas de tarea a skill en tu config de agente en lugar de la guía de descubrimiento genérica.

El agente conocerá entonces la configuración correcta de proxy/fixture, el flujo de grabar vs. reproducir y los patrones de cabeceras SSR de Next.js sin necesitar orientación.

## Las skills

`test-proxy-recorder` distribuye estas skills:

- **`proxy-setup`** — la CLI del proxy, los scripts de `package.json`, el `webServer` de `playwright.config.ts`, los fixtures por prueba, los modos grabar/reproducir/transparente, el enmascaramiento de secretos y el ciclo de grabar una vez → commit → reproducir en CI.
- **`nextjs-ssr`** — etiquetar los fetch del lado del servidor con `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, la advertencia de build-and-start frente a `next dev`, y por qué el middleware es opcional.
- **`tanstack-start`** — etiquetar los loaders, las server functions y las server routes de TanStack Start, la advertencia de build frente a `vite dev`, la división de la URL de la API entre servidor y navegador, el prefetch SSR de TanStack Query y el patrón de auth real.

Lista lo disponible en tus paquetes instalados, o carga una directamente:

```bash
npx @tanstack/intent@latest list                          # muestra las skills detectables
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## Mantener las skills (para colaboradores)

Las skills del agente viven en [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Revísalas periódicamente — y siempre que cambie la API de la librería o los ejemplos:

```bash
npx @tanstack/intent@latest validate   # comprobaciones de estructura/formato/límite de líneas (ejecuta antes de hacer commit de ediciones de skills)
npx @tanstack/intent@latest stale      # señala la deriva de versión frente a la librería publicada — vuelve a revisar las skills que lista
```

`validate` debe pasar; `stale` es orientativo — cuando reporte deriva tras una release, vuelve a revisar el contenido de la skill afectada (y sube su `library_version`).
