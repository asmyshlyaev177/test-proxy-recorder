---
title: TanStack Start
description: Una integración de primera clase para TanStack Start está en la hoja de ruta. Hasta que llegue, propaga la cabecera de sesión de grabación a mano desde las server functions.
---

:::caution[En la hoja de ruta]
Un adaptador `test-proxy-recorder/tanstack-start` de primera clase está planeado pero aún no publicado. Esta página describe el patrón manual que funciona hoy, y se reemplazará con la guía dedicada cuando el adaptador llegue. ¿Lo quieres antes? [Abre un issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

TanStack Start ejecuta loaders y server functions en el servidor, así que sus llamadas `fetch` pasan por el proxy sin un contexto de navegador — la misma situación que el [SSR de Next.js](/es/docs/integrations/nextjs/). El proxy necesita la cabecera `x-test-rcrd-id` en esas peticiones del lado del servidor para atribuirlas a la sesión de grabación correcta.

## Patrón manual (funciona hoy)

La cabecera que `playwrightProxy.before()` establece en la `page` del navegador llega en la petición entrante al servidor. Léela ahí y reenvíala en cualquier `fetch` del lado del servidor:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

Apunta la URL base de tu backend al proxy (`http://localhost:8100`) solo en dev/test, exactamente como en la [configuración manual](/es/docs/getting-started/manual-setup/). Las peticiones del lado del navegador siguen manejándose con el mecanismo HAR de `playwrightProxy.before()`.

Cuando el adaptador llegue, esto se reduce a un único import de ayudante — sigue el progreso en la [hoja de ruta](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
