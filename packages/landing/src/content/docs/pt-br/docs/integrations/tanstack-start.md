---
title: TanStack Start
description: Marque as buscas do lado do servidor do TanStack Start com o header de sessão de gravação para que o SSR seja gravado e reproduzido — via registerProxyFetch (recomendado) ou createHeadersWithRecordingId por chamada.
i18nSource: docs/integrations/tanstack-start.md
i18nSourceBlob: 6367cedc46bf4ac859e573ca269e63e8d98be33a
---

O TanStack Start roda loaders e server functions no servidor, então suas chamadas `fetch` passam pelo proxy sem um contexto de navegador — a mesma situação do [SSR do Next.js](/pt-br/docs/integrations/nextjs/). O proxy identifica a qual sessão essas requisições pertencem por meio do header `x-test-rcrd-id`. O `playwrightProxy.before()` do Playwright já o define na navegação do navegador que dispara o SSR, então o id chega na requisição de servidor de entrada — o trabalho é **anexá-lo às requisições do lado do servidor de saída**. (Testes somente de navegador não precisam de nada disso; o proxy recai na sessão definida globalmente.)

:::caution[Grave contra um build de produção]
Grave com `vite build` + `node .output/server/index.mjs` (ou seja, `pnpm start`), não `vite dev`. O contexto por requisição do servidor de desenvolvimento difere do runtime de produção que o `registerProxyFetch()` patchea. Como o servidor de produção roda em modo de produção, defina `TEST_PROXY_RECORDER_ENABLED=true` no processo da aplicação para sua execução e2e.
:::

## registerProxyFetch (recomendado)

Uma linha no seu **router setup** marca cada `fetch` do lado do servidor — route loaders, server functions e server routes:

```typescript
// src/router.tsx
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

registerProxyFetch(); // no-op no cliente / em produção a menos que TEST_PROXY_RECORDER_ENABLED=true
```

Ele faz patch do `fetch` global para copiar o `x-test-rcrd-id` da requisição atual para as requisições de saída, lendo-o do contexto de requisição de servidor do TanStack Start (`getRequestHeader`). Coloque-o no topo do `src/router.tsx` — esse módulo roda no servidor para cada requisição SSR, e a chamada é idempotente, um no-op no cliente e um no-op em produção a menos que o recorder esteja explicitamente habilitado.

## Por chamada — createHeadersWithRecordingId

Sem patch. Use-o para um único fetch dentro de um loader ou server function, ou quando você preferir não fazer patch do `fetch` global:

```typescript
import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';

const res = await fetch('http://localhost:8100/todos', {
  headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
});
```

O `getRecordingId()` também é exportado caso você queira o id bruto (ou `null`) para encaminhar por conta própria. Ambos leem o id da requisição atual a partir do contexto do servidor, e ambos são no-op em produção a menos que `TEST_PROXY_RECORDER_ENABLED=true`.

## Aponte a aplicação para o proxy

Em dev/teste, aponte as URLs base do seu backend para o proxy para que **ambas** as origens sejam gravadas — a base do lado do servidor (lida pelos loaders/server functions, por exemplo `BACKEND_URL`) e a base do lado do navegador embutida no build (`VITE_API_URL`). Em produção, aponte-as para o backend real. As requisições do lado do navegador são tratadas pelo mecanismo HAR do `playwrightProxy.before()`, exatamente como na [configuração manual](/pt-br/docs/getting-started/manual-setup/).

## Aplicações autenticadas

O recorder [funciona com o seu provedor de autenticação real](/pt-br/docs/getting-started/how-it-works/) (AWS Cognito, Auth0, Clerk, …) e se combina com a marcação de SSR acima. O padrão:

- **Faça login de verdade, no modo `transparent`.** Um projeto `setup` do Playwright faz login uma vez com o proxy em modo de passagem, para que o login **nunca seja gravado**, e salva a sessão (`storageState`) que as specs autenticadas reutilizam.
- **As requisições protegidas carregam o token e são gravadas.** Cada requisição autenticada envia um header `Authorization: Bearer …`; o recorder [o remove](/pt-br/docs/guides/secret-redaction/), então nenhum token chega às gravações commitadas.
- **Onde o token vive decide o mecanismo.** Um token em `localStorage` não pode ser lido no servidor, então o fetch protegido roda no navegador e é gravado via HAR — sem prefetch SSR. Uma sessão baseada em cookie, por outro lado, pode ser encaminhada para um loader com `createHeadersWithRecordingId()` e gravada do lado do servidor.

O aplicativo [`example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) inclui um fluxo executável de AWS Cognito `/login` → `/dashboard` (`e2e/setup-auth.ts` + `e2e/auth.spec.ts`) demonstrando exatamente isso.

## Exemplo completo

Uma aplicação completa e executável — construída com **TanStack Query** (prefetch SSR + `useMutation`), cobrindo todos (navegador + SSR), uma rota ISR com header de cache, um caso de remoção, chat WebSocket e um login real de AWS Cognito (autenticação em modo transparente + uma API protegida gravada com o token removido), tudo gravado e reproduzido — fica em [`apps/example-tanstack-start`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start). Ela mostra que o recorder é transparente para a sua camada de dados: o `registerProxyFetch()` marca os fetches `queryFn` do Query durante o SSR sem nenhum código específico do Query.
