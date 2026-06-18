---
title: Preguntas frecuentes
description: Preguntas comunes sobre test-proxy-recorder — reproducción en paralelo, commit de grabaciones a git, el destino del proxy para grabación HAR, el servidor de desarrollo de Next.js y actualización de grabaciones.
---

## Mis pruebas de reproducción en paralelo a veces llaman al backend real — ¿por qué? {#parallel-replay}

Probablemente estás llamando a `playwrightProxy.teardown()` en un hook por prueba. Establece el modo **global** del proxy a `transparent`, y con `fullyParallel: true` cada worker de Playwright ejecuta su propio `test.afterAll`. Si una prueba rápida termina y llama a `teardown()` mientras otra más lenta sigue en marcha, el proxy cambia a transparent en mitad de la prueba y las peticiones restantes se reenvían al backend real en vez de reproducirse.

```typescript
// ❌ breaks parallel replay — teardown() affects all sessions globally
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Solución:** omite `test.afterAll`. La limpieza de sesión es automática vía `context.on('close')` → `cleanupSession()`. Usa un [global teardown](https://playwright.dev/docs/test-global-setup-teardown) solo si necesitas reiniciar el proxy tras toda la ejecución.

## ¿Debo hacer commit de las grabaciones a git?

Sí. Las grabaciones deben estar en git para que CI pueda reproducirlas sin red — **no** añadas `e2e/recordings` a `.gitignore`. Para evitar que los archivos de grabación grandes inflen los diffs de PR, márcalos como binarios en `.gitattributes`:

```text
/e2e/recordings/** binary
```

## ¿Importa el `<target-url>` del proxy para la grabación solo de navegador (HAR)?

No. Para la grabación solo de navegador el destino es irrelevante — el proceso del proxy solo necesita ejecutarse para que su endpoint `/__control` esté disponible para la gestión de sesiones. El destino solo importa cuando también se enrutan peticiones del lado del servidor (SSR) por el proxy.

## ¿Puedo grabar contra el servidor de desarrollo de Next.js?

Prefiere `next build` + `next start` antes que `next dev` para grabar y reproducir. El servidor de desarrollo es lento y puede provocar timeouts o grabaciones inestables.

## ¿Cómo actualizo una grabación?

Vuelve a ejecutar en modo record (pon `MODE = 'record'` en tu fixture, o `RECORD_MODE=1`) contra la API real, luego vuelve a replay y haz commit de los archivos actualizados en `e2e/recordings/`.
