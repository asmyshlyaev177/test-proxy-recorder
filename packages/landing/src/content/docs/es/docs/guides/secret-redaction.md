---
title: Redacción de secretos
description: La redacción está activada por defecto — Authorization, Cookie y Set-Cookie se eliminan de las grabaciones antes de llegar al disco. Añade patrones de cabecera y cuerpo, permite cookies o redacta programáticamente.
---

Las grabaciones se hacen commit a git, así que los secretos se eliminan antes de escribir nada en disco. La redacción está **activada por defecto**; el proxy reemplaza los valores de estas cabeceras de petición/respuesta con `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

Esto es seguro: el emparejamiento de reproducción ignora estas cabeceras, así que la redacción nunca rompe la reproducción. Se aplica a las grabaciones `.mock.json`, a las grabaciones de WebSocket y a los archivos `.har`. Para desactivar la redacción, pasa `--no-redact` en la CLI o establece `redaction: false` en la [configuración](/es/docs/guides/config/).

Cuando solo *algunas* cookies son sensibles, permite las inofensivas por nombre (por ejemplo una cookie de `theme` o de test A/B). Las cookies permitidas conservan sus valores dentro de `Cookie`/`Set-Cookie`; cualquier otra cookie sigue redactándose.

:::note[Cómo se redactan los archivos `.har`]
Los archivos `.har` los escribe el `routeFromHAR` de Playwright, no el proxy, así que se redactan en una pasada aparte. `playwrightProxy.teardown()` reescribe cada `.har` del directorio de grabaciones usando la **misma configuración de redacción** que el proxy (las cabeceras, `allowCookies` y `bodyPatterns` se aplican, tanto a las cabeceras como a los arrays `cookies` parseados). Esto se ejecuta desde tu **`globalTeardown`** de Playwright — así que la redacción de HAR requiere un `globalTeardown` que llame a `playwrightProxy.teardown()` (la [configuración recomendada](/es/docs/integrations/playwright/#global-teardown-recommended), generada por `init`).

No puede ejecutarse por prueba: Playwright vuelca un HAR cuando su contexto se cierra pero no espera a los handlers de cierre, así que redactar ahí compite con la salida del proceso y puede truncar el archivo. El teardown obtiene la configuración de `/__control` (el proxy debe estar en ejecución; si es inalcanzable se aplican igualmente los valores por defecto de cabeceras integrados), solo reescribe los archivos que realmente cambió y deja intactos los cuerpos de respuesta en base64. Por defensa en profundidad, graba aun así con credenciales de test de corta vida y revisa los HAR antes de hacer commit — mira el patrón de auth recomendado más abajo.
:::

## Patrón de autenticación recomendado

Para mantener el flujo de login y las credenciales totalmente fuera de las grabaciones, ejecuta la autenticación en un **setup project** de Playwright con el proxy en modo `transparent`, persiste el `storageState` en un `auth-state.json` **gitignorado** y reúsalo en tus pruebas. Las peticiones grabadas entonces solo llevan las cabeceras de sesión (redactadas), nunca el login.

Mira el [ejemplo de app autenticada](/es/docs/reference/examples/#authenticated-app) para una configuración funcional contra un proveedor de auth real.

## Ajustar qué se redacta

Las cabeceras por defecto siempre se aplican (mientras la redacción está activada); puedes añadir a ellas.

### Flags de CLI

- `--no-redact` — desactiva la redacción de secretos (activada por defecto).
- `--redact` — activa la redacción de secretos; solo se necesita para reactivarla cuando la configuración pone `redaction: false`.
- `--redact-headers <names>` — nombres de cabeceras extra a redactar, separados por comas (fusionados con los valores por defecto).
- `--redact-body <patterns>` — patrones regex separados por comas a redactar de los cuerpos de petición/respuesta.
- `--allow-headers <names>` — nombres de cabeceras separados por comas a eximir de la redacción (por ejemplo `set-cookie`).
- `--allow-cookies <names>` — nombres de cookies separados por comas a mantener sin redactar dentro de `Cookie`/`Set-Cookie`.

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Programáticamente

Al construir `ProxyServer` directamente:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

`redactSession(session, config)` también se exporta si quieres redactar grabaciones existentes tú mismo.
