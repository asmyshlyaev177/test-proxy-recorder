---
title: Inicio rápido
description: Integra test-proxy-recorder en un proyecto con un solo comando init, luego graba una vez y reproduce en CI.
---

Instala:

```bash
npm install --save-dev test-proxy-recorder
```

## Lo más rápido: generar con `init`

Un solo comando integra test-proxy-recorder en un proyecto:

```bash
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

Todos los argumentos son opcionales y recurren a valores por defecto razonables (`http://localhost:3000`, puerto `8100`, `./e2e/recordings`). Genera y edita archivos de forma **no destructiva** — los archivos y scripts existentes nunca se sobrescriben salvo que pases `--force`.

### Qué genera y edita `init`

- `test-proxy-recorder.config.ts` — la configuración del proxy (autodetectada, así que `npx test-proxy-recorder` luego no necesita flags).
- `playwright.config.ts` — añade un `webServer` que apunta al endpoint `/__control` del proxy más un `globalTeardown`. Una configuración de Playwright existente se **edita en su sitio**; si no tienes Playwright en absoluto, `init` ejecuta primero la CLI de Playwright para configurarlo (pasa `--no-install` para omitirlo).
- `e2e/fixtures.ts` y `e2e/global-teardown.ts` — el fixture del proxy por prueba y el teardown.
- `package.json` — añade los scripts `proxy`, `proxy:reset`, `test:e2e` y `test:e2e:record`. Si tienes un script `dev` se envuelve: el original pasa a `dev:app` y `dev` se convierte en un comando `concurrently` que ejecuta el proxy junto a tu app (de modo que `npm run dev` graba mientras desarrollas). Se añade `concurrently` a `devDependencies`.

Una configuración de Playwright que ya define un `webServer` se deja intacta, con una nota sobre qué añadir.

## El único paso manual

El **único paso que `init` no puede hacer por ti** es enrutar las llamadas al backend de tu app a través del proxy — qué variable de entorno guarda la URL base de tu API, y cómo la limitas a dev, depende de la app. `init` imprime instrucciones concretas para esto cuando termina: apunta esa variable de entorno a `http://localhost:8100` **solo en dev/test, nunca en producción** (por ejemplo, prefija el script `dev:app`, usando `cross-env` en Windows). El proxy entonces reenvía a tu backend real mientras graba y sirve las grabaciones al reproducir.

Luego escribe una prueba, graba una vez contra la API real, cambia a reproducción y haz commit de `e2e/recordings/`. La [configuración manual](/es/docs/getting-started/manual-setup/) muestra ese ciclo completo.
