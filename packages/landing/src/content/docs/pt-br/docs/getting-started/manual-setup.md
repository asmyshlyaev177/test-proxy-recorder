---
title: Configuração manual
description: Integre o test-proxy-recorder em uma aplicação full-stack (SSR + navegador) ou em uma SPA/extensão somente de navegador à mão, e depois grave uma vez e reproduza na CI.
i18nSource: docs/getting-started/manual-setup.md
i18nSourceBlob: e501bd33c560757d3deacdb3ff90681668099473
---

A maioria das pessoas deve executar o [`init`](/pt-br/docs/getting-started/quick-start/) — ele escreve todos os arquivos abaixo para você. Esta página é a referência do que o `init` gera, para que você possa configurar à mão, dispensar a geração de código ou entender cada parte.

## Full-stack (SSR + navegador)

Para Next.js e frameworks semelhantes, onde tanto o servidor quanto o navegador fazem chamadas de API. Use os dois mecanismos de gravação juntos — veja [como funciona](/pt-br/docs/getting-started/how-it-works/).

O proxy é um processo leve que você inicia **junto com a sua aplicação durante a execução dos testes** (por um script, como abaixo, ou pelo `webServer` do Playwright) — não é infraestrutura que você implanta ou mantém. A configuração inteira é: iniciá-lo ao lado da sua aplicação, apontar a URL base da API da aplicação para ele, propagar o header de sessão a partir do SSR e escrever uma fixture.

### 1. Adicione scripts ao `package.json`

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
    "dev:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run dev\"",
    "serve:proxy": "concurrently \"npm run proxy\" \"TEST_PROXY_RECORDER_ENABLED=1 npm run serve\""
  }
}
```

No código da sua aplicação, aponte a URL base da API para o proxy quando o recorder estiver habilitado e para o backend real caso contrário — o proxy nunca roda em produção:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // endereço do proxy
```

O `TEST_PROXY_RECORDER_ENABLED` é definido pelos scripts `dev:proxy` / `serve:proxy` acima e pelos scripts gerados pelo `init`. Use a variável de ambiente que sua aplicação já usa para a URL base da API (por exemplo `API_URL`, `NEXT_PUBLIC_API_URL`) — a mesma condicional se aplica.

:::note[Next.js]
Prefira `build` + `serve` em vez de `dev` para gravar e reproduzir testes. O servidor de desenvolvimento do Next.js é lento e pode causar timeouts ou gravações instáveis.
:::

### 2. Marque as buscas do lado do servidor (Next.js)

As chamadas `fetch` do lado do servidor precisam do header de sessão de gravação para que o proxy saiba a qual teste elas pertencem. O Playwright já o define na navegação do navegador, então o id fica em `next/headers` — você só precisa anexá-lo às requisições SSR de saída. Adicione uma linha ao seu root layout (o `init` faz isso por você):

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op em produção a menos que TEST_PROXY_RECORDER_ENABLED=true

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Isso funciona nos runtimes Node **e** Edge. Para aplicações com axios, chame `registerProxyAxios(instance)` em cada instância do lado do servidor em vez disso; para um único fetch, `createHeadersWithRecordingId(await headers())` é uma alternativa sem patch. Um `proxy.ts`/`middleware.ts` com `setNextProxyHeaders` é **opcional** — ele apenas expõe o id, não marca as buscas. **Grave contra um build de produção** (`next build && next start`), não `next dev`. Veja a [integração com Next.js](/pt-br/docs/integrations/nextjs/) para detalhes. Aplicações somente de navegador podem pular esta etapa.

### 3. Escreva um teste

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Requisições SSR (servidor → proxy) são gravadas em .mock.json.
// Requisições do navegador para a URL do proxy também são cobertas.
const CLIENT_SIDE_URL = /localhost:8100/;

// Mude para 'record' para atualizar as gravações.
const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 4. Grave

```bash
# Terminal 1
npm run serve:proxy

# Terminal 2 — arquivos .mock.json e .har são gravados automaticamente
npx playwright test
```

### 5. Mude para replay e faça commit

```bash
git add e2e/recordings/
git commit -m "add e2e recordings"
```

## Somente navegador / SPA / extensão

Quando todas as chamadas de API vêm do navegador (sem SSR), você só precisa do mecanismo HAR. Nenhum backend de proxy é necessário para a gravação em si — o processo do proxy apenas fornece o gerenciamento de sessão.

### 1. Instale

```bash
npm install --save-dev test-proxy-recorder
```

### 2. Adicione o proxy ao `playwright.config.ts`

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

O alvo do proxy (`https://api.example.com`) não importa para gravação somente de navegador — ele só é usado se as requisições do lado do servidor (SSR) também precisarem ser proxied. O processo do proxy deve estar em execução para que o endpoint `/__control` fique disponível para o gerenciamento de sessão.

### 3. Escreva uma fixture

```typescript
// e2e/fixtures.ts
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Corresponda ao domínio da API externa para o qual seu navegador faz requisições.
// No modo record essas requisições vão para a API real e são salvas.
// No modo replay elas são servidas a partir do disco — sem necessidade de rede.
const CLIENT_SIDE_URL = /api\.example\.com/;

// Mude para 'record' para acessar a API real e atualizar as gravações.
const MODE = 'replay' as const;

export const test = base.extend<{ page: Page }>({
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo, MODE, { url: CLIENT_SIDE_URL });
    await use(page);
  },
});
```

### 4. Escreva um teste

```typescript
// e2e/my.test.ts
import { test, expect } from './fixtures';

test('homepage loads', async ({ page }) => {
  await page.goto('https://myapp.com/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### 5. Grave — execute uma vez contra a API real

```bash
# No fixtures.ts: const MODE = 'record' as const;
npx playwright test
# arquivos .har são gravados em e2e/recordings/ automaticamente
```

### 6. Mude para replay e faça commit

```bash
# No fixtures.ts: const MODE = 'replay' as const;
git add e2e/recordings/
git commit -m "add e2e recordings"
```

A CI agora roda sem nenhum acesso à rede.

:::caution
**Não** adicione `e2e/recordings` ao `.gitignore`. As gravações precisam estar no git para a reprodução na CI.
:::

Adicione isto ao `.gitattributes` para recolher arquivos de gravação grandes nos diffs de PR:

```text
/e2e/recordings/** binary
```
