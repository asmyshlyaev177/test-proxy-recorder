---
title: Configuration manuelle
description: Branchez test-proxy-recorder à la main dans une app full-stack (SSR + navigateur) ou une SPA/extension navigateur uniquement, puis enregistrez une fois et rejouez en CI.
---

Vous préférez une seule commande ? Voir le [démarrage rapide](/fr/docs/getting-started/quick-start/). Les configurations ci-dessous montrent la boucle complète enregistrer → rejouer à la main.

## Full-stack (SSR + navigateur)

Pour Next.js et les frameworks similaires, où le serveur et le navigateur font tous deux des appels d'API. Utilisez les deux mécanismes d'enregistrement ensemble — voir [comment ça marche](/fr/docs/getting-started/how-it-works/).

### 1. Ajoutez des scripts à `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

Dans le code de votre app, pointez l'URL de base de l'API vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production :

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // adresse du proxy
```

`TEST_PROXY_RECORDER_ENABLED` est défini par les scripts `dev:proxy` / `serve:proxy` ci-dessus, et par les scripts générés par `init`. Utilisez la variable d'environnement que votre app utilise déjà pour l'URL de base de l'API — la même condition s'applique.

:::note[Next.js]
Préférez `build` + `serve` à `dev` pour enregistrer et rejouer les tests. Le serveur de développement de Next.js est lent et peut provoquer des timeouts ou des enregistrements instables.
:::

### 2. Écrivez un test

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

### 3. Enregistrez

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — .mock.json and .har files are written automatically
npx playwright test
```

### 4. Passez en replay et committez

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Navigateur uniquement / SPA / extension

Quand tous les appels d'API viennent du navigateur (sans SSR), vous n'avez besoin que du mécanisme HAR. Aucun backend de proxy n'est requis pour l'enregistrement lui-même — le processus du proxy fournit seulement la gestion des sessions.

### 1. Installez

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Ajoutez le proxy à `playwright.config.ts`

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

La cible du proxy (`https://api.example.com`) n'a pas d'importance pour l'enregistrement navigateur uniquement — elle n'est utilisée que si des requêtes côté serveur (SSR) doivent aussi être proxifiées. Le processus du proxy doit tourner pour que son endpoint `/__control` soit disponible pour la gestion des sessions.

### 3. Écrivez une fixture

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

### 4. Écrivez un test

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Enregistrez — exécutez une fois contre la vraie API

```bash
# In fixtures.ts: const MODE = 'record' as const;
npx playwright test
# .har files are written to e2e/recordings/ automatically
```

### 6. Passez en replay et committez

```bash
# In fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

La CI tourne désormais sans aucun accès réseau.

:::caution
N'ajoutez **pas** `e2e/recordings` à `.gitignore`. Les enregistrements doivent être dans git pour le replay en CI.
:::

Ajoutez ceci à `.gitattributes` pour replier les gros fichiers d'enregistrement dans les diffs de PR :

```text
/e2e/recordings/** binary
```
