---
title: Configuración manual
description: Integra test-proxy-recorder a mano en una app full-stack (SSR + navegador) o en una SPA o extensión solo de navegador, luego graba una vez y reproduce en CI.
---

¿Prefieres un solo comando? Mira el [inicio rápido](/es/docs/getting-started/quick-start/). Las configuraciones de abajo muestran el ciclo completo grabar → reproducir a mano.

## Full-stack (SSR + navegador)

Para Next.js y frameworks similares, donde tanto el servidor como el navegador hacen llamadas a la API. Usa ambos mecanismos de grabación juntos — mira [cómo funciona](/es/docs/getting-started/how-it-works/).

### 1. Añade scripts a `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run serve\""
  }
}
```

`INTERNAL_API_URL` es la variable de entorno que tu app usa para la URL base de la API — apúntala al proxy en lugar de al backend real. Reemplázala por la variable que use tu app (por ejemplo `API_URL`, `NEXT_PUBLIC_API_URL`).

:::note[Next.js]
Prefiere `build` + `serve` antes que `dev` para grabar y reproducir pruebas. El servidor de desarrollo de Next.js es lento y puede provocar timeouts o grabaciones inestables.
:::

### 2. Escribe una prueba

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

### 3. Graba

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. Cambia a reproducción y haz commit

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
