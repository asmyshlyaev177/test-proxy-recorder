---
title: Configuración manual
description: Integra test-proxy-recorder a mano en una app full-stack (SSR + navegador) o en una SPA o extensión solo de navegador, luego graba una vez y reproduce en CI.
---

La mayoría debería ejecutar [`init`](/es/docs/getting-started/quick-start/) — escribe por ti todos los archivos de abajo. Esta página es la referencia de lo que `init` genera, para que puedas cablearlo a mano, omitir el codegen o entender cada pieza.

## Full-stack (SSR + navegador)

Para Next.js y frameworks similares, donde tanto el servidor como el navegador hacen llamadas a la API. Usa ambos mecanismos de grabación juntos — mira [cómo funciona](/es/docs/getting-started/how-it-works/).

El proxy es un proceso ligero que arrancas **junto a tu app para la ejecución de la prueba** (vía un script, como abajo, o el `webServer` de Playwright) — no es infraestructura que despliegas o mantienes. El setup completo es: arráncalo junto a tu app, apunta la URL base de la API de tu app hacia él, propaga la cabecera de sesión desde SSR y escribe un fixture.

### 1. Añade scripts a `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

En el código de tu app, apunta la URL base de la API al proxy cuando el recorder está activado, y al backend real en caso contrario — el proxy nunca se ejecuta en producción:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // dirección del proxy
```

`TEST_PROXY_RECORDER_ENABLED` lo establecen los scripts `dev:proxy` / `serve:proxy` de arriba, y los scripts generados por `init`. Usa la variable de entorno que tu app ya use para la URL base de la API (por ejemplo `API_URL`, `NEXT_PUBLIC_API_URL`) — la misma condicional aplica.

:::note[Next.js]
Prefiere `build` + `serve` antes que `dev` para grabar y reproducir pruebas. El servidor de desarrollo de Next.js es lento y puede provocar timeouts o grabaciones inestables.
:::

### 2. Etiqueta los fetch del lado del servidor (Next.js)

Las llamadas `fetch` del lado del servidor necesitan la cabecera de sesión de grabación para que el proxy sepa a qué prueba pertenecen. Playwright ya la establece en la navegación del navegador, así que el id está en `next/headers` — solo tienes que adjuntarlo a las peticiones SSR salientes. Añade una línea a tu root layout (`init` hace esto por ti):

```typescript
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

Esto funciona en los runtimes Node **y** Edge. Para apps con axios, llama a `registerProxyAxios(instance)` en cada instancia del lado del servidor; para un único fetch, `createHeadersWithRecordingId(await headers())` es una alternativa sin parchear. Un `proxy.ts`/`middleware.ts` con `setNextProxyHeaders` es **opcional** — solo expone el id, no etiqueta los fetch. **Graba contra un build de producción** (`next build && next start`), no `next dev`. Mira la [integración de Next.js](/es/docs/integrations/nextjs/) para más detalles. Las apps solo de navegador pueden saltarse este paso.

### 3. Escribe una prueba

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// SSR requests (server → proxy) are recorded to .mock.json.
// Browser requests to the proxy URL are also covered.
const CLIENT_SIDE_URL = /localhost:8100/;

// Change to 'record' to update recordings.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Graba

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 5. Cambia a reproducción y haz commit

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Solo navegador / SPA / extensión

Cuando todas las llamadas a la API vienen del navegador (sin SSR), solo necesitas el mecanismo HAR. No hace falta un backend de proxy para la grabación en sí — el proceso del proxy solo proporciona gestión de sesiones.

### 1. Instala

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Añade el proxy a `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```

El destino del proxy (`https://api.example.com`) no importa para la grabación solo de navegador — solo se usa si también hay que enrutar peticiones del lado del servidor (SSR). El proceso del proxy debe ejecutarse para que su endpoint `/__control` esté disponible para la gestión de sesiones.

### 3. Escribe un fixture

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Match the external API domain your browser makes requests to.
// In record mode these requests go to the real API and are saved.
// In replay mode they are served from disk — no network needed.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Change to 'record' to hit the real API and update recordings.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. Escribe una prueba

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Graba — ejecuta una vez contra la API real

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. Cambia a reproducción y haz commit

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

CI ahora se ejecuta sin ningún acceso a la red.

:::caution
**No** añadas `e2e/recordings` a `.gitignore`. Las grabaciones deben estar en git para la reproducción en CI.
:::

Añade esto a `.gitattributes` para colapsar archivos de grabación grandes en los diffs de PR:

```text
/e2e/recordings/** binary
```
