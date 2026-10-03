---
title: 'test-proxy-recorder vs MSW, routeFromHAR, Polly.js e o modo de teste do Next.js'
description: 'Como o test-proxy-recorder se compara com MSW, routeFromHAR, Polly.js, o modo de teste do Next.js, mockttp, Mocky Balboa, scenarist, talkback e proxay, com fontes.'
sidebar:
  label: Comparação
i18nSource: docs/reference/comparison.md
i18nSourceBlob: fef6bf06a88da123cd35aecb730f9916e9cb312f
---

Cada ferramenta aqui controla as respostas de API que um teste de ponta a ponta vê. Elas diferem em onde interceptam as requisições (no navegador, dentro do seu servidor ou em um proxy separado) e em se você escreve as respostas ou as grava. A tabela mantém as seis ferramentas da [visão geral da documentação](/pt-br/docs/#comparison) e acrescenta o modo de teste do Next.js (test mode), mockttp, scenarist, talkback e proxay. Cada célula vem da documentação, do README ou do código-fonte da própria ferramenta, com os links abaixo da tabela, conforme o estado em 2026-10-03. "Não documentado" significa que essas fontes não dizem nada a respeito.

## Tabela de recursos {#table}

| Ferramenta | Grava tráfego real | Lado do servidor (SSR) | Lado do navegador | WebSocket | Nativo do Playwright | Versão mais recente |
| --- | --- | --- | --- | --- | --- | --- |
| **test-proxy-recorder** | Sim | Sim, pelo proxy | Sim, pelo HAR | Sim | Sim | 1.3.1, 2026-08-05 |
| Playwright `routeFromHAR` | Sim | Não | Sim | Não | Embutido | Playwright 1.63.0, 2026-09-04 |
| MSW | Não (handlers, ou um HAR via `@msw/source`) | Dentro do processo do servidor | Sim | Sim | `@msw/playwright`, requisições do navegador | 3.0.2, 2026-10-03 |
| Polly.js | Sim | Dentro do processo do servidor | Sim | Não documentado | Adaptador de terceiros | `@pollyjs/core` 6.0.6, 2023-07-20 |
| playwright-network-cache | Sim | Não | Sim | Não documentado | Sim | 0.3.0, 2026-05-12 |
| Mocky Balboa | Não (handlers) | Sim | Sim | Não documentado | Sim | `@mocky-balboa/playwright` 2.0.2, 2026-05-21 |
| Modo de teste do Next.js | Não (handlers) | Sim, só Next.js | Requisições para outras origens | Não documentado | Sim | Experimental, no Next.js 16.3.8, 2026-09-30 |
| mockttp | Não documentado | Sim, como proxy de encaminhamento (forward proxy) | Sim, como proxy do navegador | Sim | Não, uma fixture que você escreve | 4.6.3, 2026-09-11 |
| scenarist | Não (cenários em código) | Next.js e Express | Não | Não documentado | Sim | 0.5.1, 2026-09-27 |
| talkback | Sim | Sim, como o endereço da API | Não documentado | Não documentado | Não | 4.2.0, 2024-07-10 |
| proxay | Sim | Sim, como o endereço da API | Sim, como o endereço da API | Não documentado | Não | npm 1.9.0, 2024-05-15; GitHub 2.0.0, 2026-01-29 |

## Fontes e observações {#sources}

As datas de lançamento vêm do registro do npm, a menos que haja um link para um release do GitHub.

- **test-proxy-recorder.** As chamadas do lado do servidor passam pelo proxy, e as do navegador, pelo HAR ([como funciona](/pt-br/docs/getting-started/how-it-works/)). As mensagens de WebSocket gravadas são reproduzidas pelo proxy ([CLI](/pt-br/docs/guides/cli/#websocket-replay-pacing)). Versão: [npm](https://www.npmjs.com/package/test-proxy-recorder).
- **Playwright `routeFromHAR`.** Com `update: true`, ele grava um HAR a partir de tráfego real ([Mock APIs](https://playwright.dev/docs/mock#mocking-with-har-files)). A reprodução serve "as requisições de rede feitas na página" ([API](https://playwright.dev/docs/api/class-page#page-route-from-har)). Ele passa por handlers de `route()` que atendem requisições HTTP e não tem caminho para WebSocket ([`harRouter.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/client/harRouter.ts)). Versão: [v1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0).
- **MSW.** Você escreve handlers de requisição. O MSW não grava nada por conta própria, mas o [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) pode gerar handlers a partir de um arquivo HAR que você exporta do DevTools do navegador. No Node.js, ele roda dentro do processo que faz as requisições ([`setupServer`](https://mswjs.io/guides/integrations/node)). WebSockets usam a [API `ws`](https://mswjs.io/docs/websocket). A integração oficial [`@msw/playwright`](https://github.com/mswjs/playwright) passa pelo `page.route()`, então cobre as requisições do navegador. Versão: [v3.0.2](https://github.com/mswjs/msw/releases/tag/v3.0.2).
- **Polly.js.** O [repositório](https://github.com/Netflix/pollyjs) o descreve como "gravar, reproduzir e criar stubs de interações HTTP". O [adaptador node-http](https://netflix.github.io/pollyjs/#/adapters/node-http) faz patch dos módulos `http` e `https` do Node, e o [adaptador fetch](https://netflix.github.io/pollyjs/#/adapters/fetch) envolve o `fetch` global. Portanto, o Polly grava dentro do processo que o executa. A documentação dele não lista nenhum adaptador de WebSocket. O suporte ao Playwright vem do [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), de terceiros, para o qual a [documentação do Polly](https://netflix.github.io/pollyjs/#/adapters/playwright) aponta. Versão: [npm](https://www.npmjs.com/package/@pollyjs/core).
- **playwright-network-cache.** O [README](https://github.com/vitalets/playwright-network-cache) diz que ele acelera os testes do Playwright "armazenando em cache as requisições de rede no sistema de arquivos". O `CacheRoute` intercepta com `page.route()` ([código-fonte](https://github.com/vitalets/playwright-network-cache/blob/main/src/CacheRoute/index.ts)), então só vê requisições do navegador. Versão: [npm](https://www.npmjs.com/package/playwright-network-cache).
- **Mocky Balboa.** Você define os mocks no teste, para requisições do servidor e do cliente, por meio de uma única API. Os mocks ficam isolados por teste enquanto os testes rodam em paralelo ([recursos](https://docs.mockybalboa.com/docs/features/)). Para Next.js 14 e posteriores, a CLI dele inicia o seu servidor Next.js ([Next.js](https://docs.mockybalboa.com/docs/server/next-js/)). A documentação dele só menciona WebSocket como o canal entre o seu servidor e o executor de testes. Versão: [npm](https://www.npmjs.com/package/@mocky-balboa/playwright).
- **Modo de teste do Next.js.** Os handlers registrados com `next.onFetch()` recebem as chamadas `fetch` do servidor, além das chamadas `fetch` da página para outras origens ([README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md), [`page-route.ts`](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/page-route.ts)). O guia de [mock do lado do servidor](/pt-br/docs/guides/server-side-mocking/#nextjs-test-mode) cobre a configuração, a situação dele e o MSW 3. Versão: [Next.js 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8).
- **mockttp.** Um servidor de mock e proxy HTTP e HTTPS para testes que rodam "no node ou em navegadores" ([README](https://github.com/httptoolkit/mockttp)). O `forAnyWebSocket()` faz mock de conexões WebSocket ([código-fonte](https://github.com/httptoolkit/mockttp/blob/main/src/mockttp.ts)). O README não descreve nenhum modo de gravação. A [publicação](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) da equipe do Playwright mostra a fixture a escrever. Versão: [npm](https://www.npmjs.com/package/mockttp).
- **scenarist.** O [README](https://github.com/citypaul/scenarist) diz que ele é "construído sobre o MSW, com gerenciamento de cenários em tempo de execução e isolamento por ID de teste", e você escreve os cenários em código. A FAQ dele diz que ele "oferece gerenciamento de cenários do lado do servidor, que complementa o mock do lado do cliente do Playwright". O código do seu servidor repassa `x-scenarist-test-id` em cada `fetch` ([adaptador para Next.js](https://github.com/citypaul/scenarist/blob/main/packages/nextjs-adapter/README.md#making-external-api-calls)), e o `@scenarist/playwright-helpers` fornece a fixture do Playwright. Versão: [npm](https://www.npmjs.com/package/@scenarist/nextjs-adapter).
- **talkback.** "Um proxy HTTP em javascript que grava e reproduz requisições HTTP" ([README](https://github.com/ijpiantanida/talkback)). A sua aplicação envia as requisições para o talkback. Uma requisição que corresponde a uma tape salva recebe a resposta da tape, e uma desconhecida é encaminhada ao host e salva como uma nova tape. O README não menciona navegadores nem tapes por teste. Versão: [npm](https://www.npmjs.com/package/talkback).
- **proxay.** Um proxy de gravação e reprodução para "um frontend web e seu backend" ou "um servidor e outro servidor" ([README](https://github.com/airtasker/proxay)). Os testes escolhem uma tape com `POST /__proxay/tape`, por exemplo no `beforeEach`, e o README não aborda testes em paralelo. A versão 2.0.0 é um [release do GitHub](https://github.com/airtasker/proxay/releases/tag/v2.0.0); o [npm](https://www.npmjs.com/package/proxay) ainda serve a 1.9.0.

## Alternativa ao Polly.js para o Playwright {#pollyjs}

O Polly.js, da Netflix, grava, reproduz e cria stubs de HTTP, e foi a inspiração do test-proxy-recorder. A situação dele em 2026-10-03:

- O `@pollyjs/core` não tem nenhum lançamento desde a 6.0.6, em 2023-07-20. A última mudança do repositório, em 2025-05-31, publicou o `@pollyjs/adapter-fetch` 6.0.7, que retirou a descontinuação do adaptador fetch para Node ([Netflix/pollyjs#506](https://github.com/Netflix/pollyjs/pull/506)).
- O Polly não tem um adaptador próprio para o Playwright. A documentação dele aponta para o [polly-adapter-playwright](https://github.com/redabacha/polly-adapter-playwright), de terceiros, que se conecta a um contexto de navegador ou a uma página. O último lançamento dele, 2.4.0, foi em 2024-04-18.
- Para chamadas do lado do servidor, o Polly precisa rodar dentro do processo do servidor, por meio do adaptador node-http ou do adaptador fetch.

Se você está migrando do Polly.js, os conceitos dele correspondem aos do test-proxy-recorder assim:

| Polly.js | test-proxy-recorder |
| --- | --- |
| Modos `record`, `replay` e `passthrough` ([configuração](https://netflix.github.io/pollyjs/#/configuration)) | Modos `record`, `replay` e `transparent`, definidos por teste pelo `playwrightProxy.before()` |
| Uma gravação nomeada por instância do Polly, salva por um persister | Um `.mock.json` (servidor) e um `.har` (navegador) por teste do Playwright, no diretório de gravações |
| Adaptadores dentro do processo que faz as requisições | Um processo de proxy para as chamadas do servidor, HAR para as chamadas do navegador e `registerProxyFetch()` no servidor |
| Por padrão, a correspondência das requisições usa método, headers, corpo, ordem e URL | A correspondência das requisições do lado do servidor usa método, caminho e um hash da query, na ordem gravada, sem comparar os corpos. As requisições do navegador seguem as regras de HAR do Playwright, que também comparam os corpos de POST |

## MSW com Next.js e Playwright {#msw}

Em uma aplicação Next.js, as requisições do navegador e as do servidor precisam de configurações diferentes do MSW.

- **Requisições do navegador.** O [`@msw/playwright`](https://github.com/mswjs/playwright), a integração oficial, executa os seus handlers por meio do `page.route()`, com uma fixture `network` que você pode mudar por teste.
- **Requisições do servidor.** O MSW roda dentro do processo do Next.js. A documentação do MSW não tem um guia de Next.js, e o exemplo de referência é um pull request aberto, o [mswjs/examples#101](https://github.com/mswjs/examples/pull/101). Os handlers que você muda em tempo de execução são compartilhados por todos os testes que chegam a esse servidor. O guia de [mock do lado do servidor](/pt-br/docs/guides/server-side-mocking/#msw) traz os detalhes e as fontes.
- **Handlers de servidor por teste.** O modo de teste do Next.js aceita handlers do MSW por teste, mas o ponto de entrada dele para o MSW não carrega com o MSW 3.0 ([detalhes](/pt-br/docs/guides/server-side-mocking/#nextjs-test-mode)). O scenarist monta cenários por teste sobre o MSW para Next.js e Express, e o código do seu servidor repassa um header com o id do teste em cada `fetch`.
- **Gravação.** O MSW não grava tráfego. O [`@msw/source`](https://mswjs.io/ecosystem/source/integrations/har) transforma um arquivo HAR, exportado do DevTools do navegador, em handlers.

O test-proxy-recorder faz a troca oposta. Ele grava os dois lados a partir da API real, então não há handlers para escrever. Em compensação, você tem menos controle sobre as respostas que a API não produz sob demanda.

## Quando usar outra ferramenta {#when-to-use-something-else}

- **Todo o seu tráfego é do lado do navegador.** O `routeFromHAR` embutido do Playwright não precisa de nenhuma dependência extra. Comece por ele e adicione o test-proxy-recorder quando aparecerem requisições do lado do servidor.
- **Você quer escrever as respostas à mão ou forçar erros e casos-limite.** Os handlers do MSW se encaixam melhor nisso, e o MSW também roda no [Vitest](https://mswjs.io/guides/integrations/vitest), no [Storybook](https://mswjs.io/guides/integrations/storybook) e [no navegador](https://mswjs.io/guides/integrations/browser), não só no Playwright. Para handlers do lado do servidor por teste no Playwright, veja o Mocky Balboa, o scenarist ou o modo de teste do Next.js.
- **Você só precisa de cache do lado do navegador, com pouca configuração.** O [playwright-network-cache](https://github.com/vitalets/playwright-network-cache) guarda as respostas em cache no disco por meio de uma única fixture.
- **O seu servidor não é escrito em JavaScript, ou você não pode mudar o código dele.** Um proxy de encaminhamento como o mockttp funciona por meio de `HTTPS_PROXY`. A [publicação](https://dev.to/playwright/mocking-server-side-http-in-playwright-with-mockttp-58jo) da equipe do Playwright diz que Python, Go, Ruby, Rust e .NET funcionam do mesmo jeito, e que o Java precisa de `-Dhttps.proxyHost` e `-Dhttps.proxyPort`.
- **Você precisa gravar e reproduzir fora do Playwright, em qualquer linguagem.** O proxay e o talkback são servidores HTTP independentes que salvam as gravações como arquivos de tape.
