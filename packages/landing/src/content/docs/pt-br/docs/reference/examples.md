---
title: Aplicações de exemplo
description: Exemplos completos e funcionais do test-proxy-recorder — SSR de Next.js e TanStack Start, uma extensão do Chrome, um ticker de WebSocket de terceiros e uma aplicação autenticada reproduzida sem backend.
i18nSource: docs/reference/examples.md
i18nSourceBlob: d58a37f3eb41cbc0c0319b630b35da2930081ea1
---

Os exemplos completos e funcionais ficam em [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — um por mecanismo de gravação. Cada um tem seu próprio README com a configuração completa e o fluxo de gravar/reproduzir.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — um aplicativo de todos com Next.js 16, um backend mock, proxy e testes e2e do Playwright. Grava tanto buscas SSR (`.mock.json`) quanto buscas do navegador (`.har`) e inclui um chat WebSocket contra o backend local. Veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

## Next.js Edge runtime {#nextjs-edge}

[`apps/example-nextjs-edge`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — um aplicativo Next.js 16 cuja página renderiza no **Edge runtime** (`export const runtime = 'edge'`). O `fetch` SSR dele é marcado com o id de sessão de gravação via `registerProxyFetch()` (chamado do root layout), para que sessões de reprodução concorrentes permaneçam distintas onde o `instrumentation.ts` não consegue alcançar. Veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs-edge/README.md).

## TanStack Start {#tanstack-start}

[`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — um aplicativo TanStack Start (Vite + Nitro) construído com **TanStack Query**. Grava tanto buscas SSR (`.mock.json`, marcadas via `registerProxyFetch()` no `src/router.tsx`) quanto buscas do navegador (`.har`), cobrindo uma lista de todos ao vivo, uma rota ISR com header de cache, chat WebSocket e um login real de **AWS Cognito** (autenticação em modo transparente + uma API protegida com o token removido). Veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-tanstack-start/README.md).

## Extensão do Chrome {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — uma extensão real do Chrome que chama a API do X/Twitter a partir de um content script; as requisições do navegador são gravadas em `.har` e reproduzidas offline, sem necessidade de API ou conta ao vivo na CI. Veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

## Crypto ticker — WebSocket de terceiros {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — um ticker de preço BTC-USD ao vivo apoiado pelo feed WebSocket público da Binance. Grava o feed real uma vez pelo proxy e depois reproduz preços determinísticos na CI sem rede nem conta de exchange. Veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

## Aplicação autenticada {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — um aplicativo Next.js que faz login em um **user pool AWS Cognito real** e depois grava/reproduz sua API protegida. O login permanece ao vivo a cada execução (nunca gravado); os dados protegidos são reproduzidos com o backend desligado, e o token de autenticação é removido das gravações. A integração é apenas um punhado de arquivos — veja o seu [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md). Para o mesmo padrão **sem conta na nuvem**, veja [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
