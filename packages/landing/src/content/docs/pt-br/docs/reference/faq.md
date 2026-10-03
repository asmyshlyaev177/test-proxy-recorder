---
title: FAQ
description: Perguntas frequentes sobre o test-proxy-recorder — reprodução em paralelo, commitar gravações no git, o alvo do proxy para gravação HAR, o servidor de desenvolvimento do Next.js e a atualização das gravações.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 59a850f40bf95a3cbc42808fac8a58ee42a6465a
---

## Meus testes de reprodução em paralelo às vezes acessam o backend real — por quê? {#parallel-replay}

Você provavelmente está chamando `playwrightProxy.teardown()` em um hook por teste. Ele define o modo **global** do proxy para `transparent` e, com `fullyParallel: true`, cada worker do Playwright roda seu próprio `test.afterAll`. Se um teste rápido termina e chama `teardown()` enquanto um teste mais lento ainda está rodando, o proxy muda para transparent no meio do teste e as requisições restantes são encaminhadas para o backend real em vez de serem reproduzidas.

```typescript
// ❌ quebra a reprodução em paralelo — teardown() afeta todas as sessões globalmente
test.afterAll(async () => {
  await playwrightProxy.teardown();
});
```

**Correção:** omita o `test.afterAll`. A limpeza da sessão é automática via `context.on('close')` → `cleanupSession()`. Use um [teardown global](https://playwright.dev/docs/test-global-setup-teardown) apenas se você precisar redefinir o proxy após toda a execução.

O timeout da sessão é a outra forma pela qual uma execução de reprodução chega ao backend real. Cada chamada a `playwrightProxy.before()` o reinicia, e as requisições que passam pelo proxy não. Se ele se esgotar (120000 ms por padrão) antes da próxima chamada a `before()`, o proxy muda para `transparent`. Um teste que ainda esteja rodando passa então a enviar as requisições restantes ao backend real. Se um único teste puder durar tanto, aumente o timeout com `--timeout` na [CLI](/pt-br/docs/guides/cli/) ou com `timeout` na [config](/pt-br/docs/guides/config/).

## Posso gravar com workers em paralelo? {#parallel-recording}

Não. O proxy mantém uma única sessão de gravação por vez. Quando um segundo teste começa a gravar, o proxy salva o arquivo do primeiro teste e passa para o segundo. As requisições restantes do primeiro teste que passam pelo proxy acabam então no `.mock.json` do segundo teste. Grave com um único worker, como já faz o script `test:e2e:record` que o `init` adiciona:

```bash
npx playwright test --workers 1
```

A reprodução pode rodar com workers em paralelo. Cada teste reproduz a própria sessão, e o header `x-test-rcrd-id` as diferencia: o `playwrightProxy.before()` o define nas requisições da página, e o `registerProxyFetch()` o copia para as do lado do servidor. É por isso que as [aplicações de exemplo](/pt-br/docs/reference/examples/) gravam com `--workers 1`.

## Devo commitar as gravações no git?

Sim. As gravações precisam estar no git para que a CI possa reproduzi-las sem rede — **não** adicione `e2e/recordings` ao `.gitignore`. Para que arquivos de gravação grandes não atrapalhem a revisão de PRs, marque-os como gerados no `.gitattributes`: o GitHub recolhe os diffs deles por padrão e ainda os mostra com um clique, então um campo que a API renomeou continua visível na revisão. Marcá-los como `binary` esconderia essa mudança por completo.

```text
/e2e/recordings/** linguist-generated=true
```

## O `<target-url>` do proxy importa para gravação somente de navegador (HAR)?

Não. Para gravação somente de navegador, o alvo é irrelevante — o processo do proxy só precisa estar em execução para que o endpoint `/__control` fique disponível para o gerenciamento de sessão. O alvo só importa quando as requisições do lado do servidor (SSR) também são roteadas pelo proxy.

## O que acontece com as requisições do navegador fora do padrão de `url`? {#outside-url}

O Playwright não as intercepta, então elas vão para a rede real, tanto na gravação quanto na reprodução. Nada é salvo para elas. As requisições ao proxy (`localhost:8100`) são a exceção. O `playwrightProxy.before()` sempre as repassa ao proxy, que as grava e as reproduz por conta própria.

Para manter um teste fora da rede, amplie o `url` para que o HAR cubra o domínio, ou bloqueie o domínio com `page.route()` e `route.abort()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const MODE = 'replay' as const;

test.beforeEach(async ({ page }, testInfo) => {
  // O HAR também grava e reproduz a CDN.
  await playwrightProxy.before(page, testInfo, MODE, {
    url: /localhost:8100|cdn\.example\.com/,
  });

  // As chamadas de analytics falham em vez de chegar à rede.
  await page.route(/analytics\.example\.com/, (route) => route.abort());
});
```

A seção [correspondência de requisições na reprodução](/pt-br/docs/getting-started/how-it-works/#replay-matching) traz os detalhes.

## Posso gravar contra o servidor de desenvolvimento do Next.js?

Prefira `next build` + `next start` em vez de `next dev` para gravar e reproduzir. O servidor de desenvolvimento é lento e pode causar timeouts ou gravações instáveis.

## Como atualizo uma gravação?

Execute novamente no modo record (defina `MODE = 'record'` na sua fixture, ou `RECORD_MODE=1`) contra a API real, depois volte para replay e commite os arquivos atualizados em `e2e/recordings/`.

## Posso forçar um erro, uma lista vazia ou uma resposta lenta em um teste reproduzido? {#override-responses}

Sim, para requisições do navegador. O Playwright executa os handlers de rota [na ordem inversa do registro](https://playwright.dev/docs/api/class-route#route-fallback), então um `page.route()` adicionado depois de `playwrightProxy.before()` vê cada requisição primeiro. Ele pode responder à requisição por conta própria ou chamar `route.fallback()` para repassá-la às gravações.

```typescript
// e2e/todos-error.test.ts
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const CLIENT_SIDE_URL = /localhost:8100/;

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: CLIENT_SIDE_URL });
});

test('shows an error when todos fail to load', async ({ page }) => {
  // Adicionado depois de before(), então o Playwright executa este handler primeiro.
  await page.route(CLIENT_SIDE_URL, async (route) => {
    if (new URL(route.request().url()).pathname === '/todos') {
      await route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
      return;
    }
    await route.fallback(); // todas as outras requisições são reproduzidas como foram gravadas
  });

  await page.goto('/');
  await expect(page.getByText('Could not load todos')).toBeVisible();
});
```

Para uma lista vazia, responda com `json: []` no lugar do erro. Para uma resposta lenta, espere antes de chamar `route.fallback()`, por exemplo com `await new Promise((resolve) => setTimeout(resolve, 3000))`. A resposta gravada então chega três segundos atrasada.

As requisições do lado do servidor nunca passam pelo navegador, então o `page.route()` não consegue alterá-las. Para elas, edite a gravação no `.mock.json` à mão, ou grave contra uma API que esteja no estado de que você precisa. No arquivo, o `response` de cada gravação contém `statusCode`, `headers` e `body`. Se você mudar o tamanho do corpo, apague também o header `content-length`.

## Posso usá-lo quando a suite testa um ambiente implantado? {#deployed-environment}

Sim, para requisições do navegador. O Playwright as intercepta no navegador, então o HAR as grava e reproduz sem nenhuma mudança na aplicação implantada. Aponte `url` para o domínio da API que o navegador chama. O proxy ainda precisa rodar ao lado dos testes, porque o `playwrightProxy.before()` define o modo de cada teste pelo endpoint `/__control` do proxy.

As requisições do lado do servidor são feitas pelo servidor da aplicação, então um proxy na CI nunca vê as que um servidor implantado faz. Para gravá-las ou reproduzi-las, rode o servidor da aplicação na CI ao lado do proxy. Faça o build e inicie-o para a execução dos testes com a URL base da API apontando para o proxy e com `TEST_PROXY_RECORDER_ENABLED=true` definido. As páginas de [Next.js](/pt-br/docs/integrations/nextjs/) e [TanStack Start](/pt-br/docs/integrations/tanstack-start/) mostram essa configuração.
