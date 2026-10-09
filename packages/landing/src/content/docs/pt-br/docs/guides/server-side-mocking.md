---
title: 'Mock de requisições do lado do servidor no Playwright (Next.js, TanStack Start)'
description: 'Por que o page.route() não vê as buscas do lado do servidor no Next.js e no TanStack Start, e como o modo de teste, o MSW, o mockttp ou respostas gravadas lidam com elas no Playwright.'
sidebar:
  label: Mock do lado do servidor
i18nSource: docs/guides/server-side-mocking.md
i18nSourceBlob: 6fd6662395c2237b6c951527806be5bd6116dec1
---

Em uma aplicação Next.js ou TanStack Start, o servidor chama a sua API enquanto renderiza uma página. O mock de requisições do Playwright nunca vê essas chamadas. As seções abaixo explicam por quê e depois comparam quatro formas de controlá-las em um teste do Playwright: o modo de teste do Next.js (test mode), o MSW dentro do servidor, um proxy de encaminhamento (forward proxy) como o mockttp e a gravação de respostas reais com o test-proxy-recorder. Os fatos sobre as outras ferramentas foram conferidos na documentação e no código-fonte de cada uma em 2026-10-03.

## Por que o `page.route()` não vê as requisições do lado do servidor {#why}

O [`page.route()`](https://playwright.dev/docs/api/class-page#page-route) do Playwright atua sobre "requisições de rede feitas por uma página". Já um Server Component, um loader de rota ou uma server function roda no processo Node.js da sua aplicação. O `fetch` dele vai desse processo direto para a API. A requisição nunca passa pelo navegador, então o Playwright não tem o que interceptar. O `page.route()` vê, sim, a requisição da página que o navegador envia para a sua aplicação e o HTML que volta. Ele nunca vê as requisições que o servidor fez para montar esse HTML.

Os arquivos HAR têm o mesmo limite, porque o [`page.routeFromHAR()`](https://playwright.dev/docs/api/class-page#page-route-from-har) serve "as requisições de rede feitas na página".

A [comparação do MSW com o Playwright](https://mswjs.io/docs/comparison#playwright) diz o mesmo: o `page.route()` afeta "o tráfego no navegador iniciado, não o processo Node.js". A [publicação da equipe do Playwright sobre mock do lado do servidor](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) diz que o `page.route()` funciona para requisições do navegador e que, "para chamadas HTTP do lado do servidor, não funciona". O pedido de recurso de um mock do lado do servidor embutido, [microsoft/playwright#30766](https://github.com/microsoft/playwright/issues/30766), foi fechado em 2026-05-22 com um link para essa publicação.

## Modo de teste do Next.js {#nextjs-test-mode}

O Next.js traz uma integração experimental com o Playwright em `next/experimental/testmode/playwright`. A única documentação dela é um [README no repositório do Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), e o [guia de Playwright do Next.js](https://nextjs.org/docs/app/guides/testing/playwright) não a menciona. Um teste registra handlers com `next.onFetch()`, e o Next.js envia as chamadas `fetch` do servidor para eles:

```typescript
// Resumido a partir do README
import { test, expect } from 'next/experimental/testmode/playwright';

test('/product/shoe', async ({ page, next }) => {
  next.onFetch((request) => {
    if (request.url === 'http://my-db/product/shoe') {
      return new Response(JSON.stringify({ title: 'A shoe' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return 'abort';
  });

  await page.goto('/product/shoe');
  await expect(page.locator('body')).toHaveText(/Shoe/);
});
```

O que ele exige:

- `experimental: { testProxy: true }` no `next.config.js`.
- Um `playwright.config.ts` criado com o `defineConfig` de `next/experimental/testmode/playwright`, e testes que importam `test` do mesmo módulo.

Por baixo dos panos, cada worker do Playwright inicia um pequeno servidor proxy. A fixture adiciona um header `Next-Test-Proxy-Port` (esse proxy) e um header `Next-Test-Data` (o id do teste) às requisições da página ([`next-fixture.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/next-fixture.ts)). Com o `testProxy` ativado, o servidor lê esses headers e envia cada `fetch` do lado do servidor para esse proxy. O proxy entrega a requisição aos handlers desse teste ([`fetch.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/fetch.ts)). Os handlers são mantidos por id de teste, então testes em paralelo podem compartilhar um único servidor Next.js. Uma busca do servidor que nenhum handler responde lança `Proxy request aborted`. Em vez disso, um handler pode retornar `'continue'` para deixar a requisição passar. O `next.onFetch()` também recebe as chamadas `fetch` da própria página para outras origens.

Situação:

- Experimental. O caminho de importação e a chave de config dizem isso, e o README se chama "Experimental test mode for Playwright".
- Ainda recebe correções. A mais recente, [vercel/next.js#96525](https://github.com/vercel/next.js/pull/96525), foi mesclada em 2026-08-13.
- O README também oferece handlers do MSW por teste por meio de `next/experimental/testmode/playwright/msw`. Com o MSW 3.0 (lançado em 2026-09-28), esse ponto de entrada não carrega. Ele importa o `strict-event-emitter`, do qual o MSW 3.0 não depende mais. Ele também chama o `handleRequest()` do MSW, que a versão 3.0 removeu ([notas de lançamento do MSW 3.0](https://github.com/mswjs/msw/releases/tag/v3.0.0), [`msw.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/msw.ts)). Com o MSW 2.15.0 ele carrega. Os dois resultados são do Next.js 16.3.8, conferidos em 2026-10-03.

## MSW no servidor do Next.js {#msw}

O MSW intercepta requisições no Node.js com o `setupServer` de `msw/node` ([integração com Node.js](https://mswjs.io/guides/integrations/node)). A documentação dele não tem um guia de Next.js. Quando o autor do MSW fechou a issue sobre o App Router, ele indicou o [mswjs/examples#101](https://github.com/mswjs/examples/pull/101) como referência de integração ([comentário](https://github.com/mswjs/msw/issues/1644#issuecomment-2433234922)). Esse pull request está aberto desde 2024-01-22. Ele inicia o interceptador a partir do root layout, com uma lista fixa de handlers:

```tsx
// app/layout.tsx, de mswjs/examples#101
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { server } = require('@/mocks/node'); // setupServer(...handlers)
  server.listen();
}
```

Os handlers então vivem no processo do Next.js. O exemplo inicia esse processo com o `webServer` do Playwright, que roda um único processo para a execução inteira ([publicação da equipe do Playwright](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo#why-not-playwrights-raw-webserver-endraw-)). Todos os workers enviam suas páginas para esse único servidor, e workers em paralelo mudam o comportamento dos handlers dele:

- Um teste não pode chamar `server.use()` nesse servidor, porque o teste roda no próprio processo de worker. O MSW não tem uma API lançada para mudar handlers em outro processo. A proposta, `setupRemoteServer` em [mswjs/msw#1617](https://github.com/mswjs/msw/pull/1617), está aberta desde 2023-05-12. A integração do MSW com o Playwright diz que depende do `page.route()` até que isso seja lançado ([`@msw/playwright`](https://github.com/mswjs/playwright)).
- Se você adicionar um canal próprio, como uma rota de API que chama `server.use()`, a mudança atinge todos os testes. Os handlers adicionados com [`server.use()`](https://mswjs.io/api/setup-server/use) "persistem na instância do servidor". A [publicação sobre o server boundary](https://mswjs.io/blog/introducing-server-boundary) explica que sobrescritas concorrentes em um único servidor se tornam "um estado global compartilhado entre todos os testes". Na #1617, o autor do MSW observa que, na prática, ou você mantém "uma lista fixa de handlers" ou inicia "uma instância da aplicação por caso de teste".

Na prática, o MSW dentro de um servidor Next.js compartilhado dá as mesmas respostas a todos os testes em paralelo. Duas ferramentas acrescentam handlers por teste sobre o MSW. O modo de teste do Next.js aceita handlers do MSW (com o MSW 2, veja acima). O [scenarist](https://github.com/citypaul/scenarist) identifica os cenários por um header `x-scenarist-test-id` que o código do seu servidor repassa em cada `fetch` ([adaptador para Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)).

## Um proxy de encaminhamento como o mockttp {#mockttp}

Quando a equipe do Playwright fechou a #30766, ela [indicou](https://github.com/microsoft/playwright/issues/30766#issuecomment-4519133681) a [publicação](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) de Simon Knott. A publicação coloca o [mockttp](https://github.com/httptoolkit/mockttp), um servidor de mock e proxy HTTP e HTTPS, na frente do tráfego de saída do servidor. Cada teste adiciona regras a ele, como `mocks.forPost(url).thenJson(200, body)`.

O código da aplicação não muda. O processo do servidor dela é iniciado com variáveis de ambiente que enviam as requisições de saída pelo proxy:

- `HTTP_PROXY` e `HTTPS_PROXY` definidas com a URL do proxy.
- `NODE_USE_ENV_PROXY=1`, para que o `fetch` embutido do Node use essas variáveis. O Node.js a adicionou nas versões 24.0.0 e 22.21.0 e a marca como em desenvolvimento ativo ([documentação do Node.js](https://nodejs.org/api/cli.html#node_use_env_proxy1)).
- `NODE_EXTRA_CA_CERTS` apontando para o certificado de CA do proxy, para que o servidor confie nos certificados que o mockttp gera para hosts HTTPS.

O proxy pertence a um único worker do Playwright, então a publicação inicia um servidor da aplicação por worker a partir de uma fixture de worker, cada um em uma porta livre. Ela evita o `webServer` do Playwright, que inicia um único processo para a execução inteira antes de existir qualquer worker. Na configuração da publicação, as requisições sem regra passam direto para a API real. A publicação sugere responder a elas com um erro, para que um mock esquecido apareça.

A equipe do Playwright descreve a abordagem como "agnóstica em relação à linguagem e ao framework do servidor". A própria publicação usa um servidor Node simples, não Next.js nem TanStack Start.

## Grave respostas reais com o test-proxy-recorder {#test-proxy-recorder}

Com as três opções acima, você mesmo escreve cada resposta. O test-proxy-recorder grava o que a sua API real retorna durante uma execução local e depois reproduz isso na CI.

- **O proxy.** Inicie o `test-proxy-recorder <target-url>` ao lado da sua aplicação durante a execução dos testes. Aponte a URL base da API da aplicação para ele enquanto `TEST_PROXY_RECORDER_ENABLED` estiver definido. Cada proxy encaminha para um único backend, o `<target-url>` com que foi iniciado.
- **`registerProxyFetch()`.** Uma única chamada no servidor faz patch do `fetch` global. Ela copia o header `x-test-rcrd-id` da requisição atual para cada requisição de saída. O proxy lê esse header para associar cada chamada do lado do servidor ao respectivo teste. A chamada é um no-op em produção, a menos que `TEST_PROXY_RECORDER_ENABLED` esteja definido.
- **O id por teste.** O `playwrightProxy.before(page, testInfo, mode)` monta um id de sessão a partir do arquivo de spec, dos seus títulos de `describe` e do título do teste. Ele envia esse id como `x-test-rcrd-id` nas requisições da página e muda essa sessão para `record` ou `replay`. Workers em paralelo compartilham um único servidor da aplicação e um único proxy, e cada teste ainda tem a própria gravação.

```typescript
// Next.js: app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch();
```

```typescript
// TanStack Start: src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch();
```

```typescript
// e2e/fixtures.ts
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay', { url: /localhost:8100/ });
});
```

Grave uma vez contra a API real e faça commit dos arquivos `.mock.json` (servidor) e `.har` (navegador). A CI então os reproduz com o backend desligado. Na reprodução, uma requisição sem gravação recebe um 404 que a identifica. Ela nunca chega à API.

As respostas gravadas só cobrem o que a API fez enquanto você gravava. Para forçar um erro ou um caso-limite que a API não produz sob demanda, um handler escrito à mão, de uma das opções acima, é mais simples.

Os detalhes de configuração estão nos guias de [Next.js](/pt-br/docs/integrations/nextjs/) e [TanStack Start](/pt-br/docs/integrations/tanstack-start/).

## Compare as opções {#comparison}

| Opção | Configuração na aplicação | Testes em paralelo | Handlers ou respostas gravadas | Next.js e TanStack Start |
| --- | --- | --- | --- | --- |
| [Modo de teste do Next.js](#nextjs-test-mode) | `experimental.testProxy` no `next.config.js` | Sim, os handlers são mantidos por teste | Handlers (`next.onFetch()` ou handlers do MSW 2) | Só Next.js |
| [MSW no servidor](#msw) | `setupServer` iniciado no código do servidor (o root layout, no exemplo do MSW) | Um único conjunto de handlers para todos os testes nesse servidor | Handlers | Next.js: um exemplo em um pull request aberto. TanStack Start: não documentado |
| [mockttp](#mockttp) | Nenhuma mudança de código. Variáveis de proxy e um certificado de CA no processo do servidor | Sim, com um servidor da aplicação por worker | Handlers. As requisições sem regra passam direto | Não documentado. A equipe do Playwright o chama de agnóstico de framework |
| [test-proxy-recorder](#test-proxy-recorder) | URL base da API apontando para o proxy durante os testes, mais `registerProxyFetch()` | Sim, com um único servidor da aplicação compartilhado | Gravadas da API real | Ambos documentados |

A [comparação](/pt-br/docs/reference/comparison/) cobre mais ferramentas, incluindo Mocky Balboa, scenarist, Polly.js, talkback e proxay, e as opções do lado do navegador.
