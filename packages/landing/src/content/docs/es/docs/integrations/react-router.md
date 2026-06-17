---
title: React Router / Remix
description: Una integración de primera clase para React Router 7 (framework mode) y Remix está en la hoja de ruta. Hasta que llegue, reenvía la cabecera de sesión de grabación a mano desde loaders y actions.
---

:::caution[En la hoja de ruta]
Un adaptador de primera clase para React Router 7 framework mode (lo que «Remix» significa en la práctica ahora) está planeado pero aún no publicado. Esta página describe el patrón manual que funciona hoy, y se reemplazará con la guía dedicada cuando el adaptador llegue. ¿Lo quieres antes? [Abre un issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

Los loaders y actions de React Router 7 se ejecutan en el servidor, así que sus llamadas `fetch` pasan por el proxy sin un contexto de navegador — la misma situación que el [SSR de Next.js](/es/docs/integrations/nextjs/). El proxy necesita la cabecera `x-test-rcrd-id` en esas peticiones del lado del servidor para atribuirlas a la sesión de grabación correcta.

## Patrón manual (funciona hoy)

Cada loader/action recibe el `request` entrante. Lee la cabecera del id de grabación de él y reenvíala en cualquier `fetch` del lado del servidor:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Apunta la URL base de tu backend al proxy (`http://localhost:8100`) solo en dev/test, exactamente como en la [configuración manual](/es/docs/getting-started/manual-setup/). Las peticiones del lado del navegador siguen manejándose con el mecanismo HAR de `playwrightProxy.before()`.

Cuando el adaptador llegue, esto se reduce a un único import de ayudante — sigue el progreso en la [hoja de ruta](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
