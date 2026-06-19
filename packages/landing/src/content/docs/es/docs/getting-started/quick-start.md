---
title: Inicio rápido
description: Integra test-proxy-recorder con un solo comando init — idealmente guiado por un agente de IA. Apunta tu API al proxy, graba una vez, reproduce en CI.
---

## Configúralo con un agente de IA (recomendado)

Copia esto y pégalo en tu agente de codificación con IA (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

El agente añade los skills, genera todo el andamiaje con `init` (config, el fixture de Playwright, el teardown, los scripts y — en Next.js — `registerProxyFetch()` en tu root layout), y luego termina el cableado que `init` no puede adivinar a partir del prompt que `init` imprime. ¿Quieres un setup terminado para copiar? Mira los [ejemplos](/es/docs/reference/examples/).

## O cablea a mano

`init` lo escribe todo y no sobrescribe nada:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # Solo Next.js — añade registerProxyFetch() para etiquetar los fetch SSR
e2e/fixtures.ts          # grabar vs reproducir
e2e/global-teardown.ts
package.json             # + scripts proxy / test:e2e
```

### 1. Apunta la API de tu app al proxy

Lo único que `init` no puede adivinar: qué variable de entorno guarda la URL base de tu API. Apúntala al proxy cuando el grabador está activo, y al backend real en caso contrario — el proxy nunca se ejecuta en producción:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // dirección del proxy según `init`
```

### 2. Etiqueta los fetch del lado del servidor (solo Next.js)

Las peticiones del navegador ya llevan el id de sesión de grabación (Playwright lo establece). Para los fetch del lado del servidor (SSR, Server Components), añade una línea a tu root layout para que también queden etiquetados — `init` hace esto por ti:

```tsx
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op en producción salvo TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

¿Usas axios para llamadas del lado del servidor? Usa `registerProxyAxios(instance)` en su lugar.
Graba contra un build de producción (`next build && next start`), no `next dev`.
Las apps solo de navegador (SPA, extensión) pueden saltarse este paso.

### 3. Graba una vez, reproduce para siempre

```bash
# fixtures.ts: MODE = 'record' — captura respuestas reales
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — luego haz commit de las grabaciones
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

Ahora CI reproduce con el backend apagado — mismas respuestas cada vez.

---

Más detalle: [configuración manual](/es/docs/getting-started/manual-setup/) · [cómo funciona](/es/docs/getting-started/how-it-works/) · [skills para agentes de IA](/es/docs/reference/ai-agent-skills/).
