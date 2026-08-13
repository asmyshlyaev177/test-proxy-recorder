---
title: Next.js
description: Marque as buscas do lado do servidor do Next.js com o header de sessão de gravação para que o SSR seja gravado e reproduzido — via registerProxyFetch (recomendado, qualquer runtime), registerProxyAxios para axios ou createHeadersWithRecordingId por chamada. O middleware é opcional.
i18nSource: docs/integrations/nextjs.md
i18nSourceBlob: 5cf29035e538718ddd86bfc78d782a0468c8c3f7
---

Frameworks SSR como o Next.js fazem chamadas `fetch` do lado do servidor que passam pelo proxy sem um contexto de navegador. O proxy identifica a qual sessão essas requisições pertencem por meio do header `x-test-rcrd-id`. O `playwrightProxy.before()` do Playwright já o define na navegação do navegador que dispara o SSR, então o id fica disponível em `next/headers` — o trabalho é **anexá-lo às requisições do lado do servidor de saída**. (Testes somente de navegador não precisam de nada disso; o proxy recai na sessão definida globalmente.)

:::tip
O [`test-proxy-recorder init`](/pt-br/docs/getting-started/quick-start/) detecta o Next.js e conecta automaticamente a abordagem recomendada abaixo ao seu root layout.
:::

:::caution[Grave contra um build de produção]
Grave com `next build && next start`, não `next dev`. O servidor de desenvolvimento pode redefinir o patch global do `fetch` entre requisições ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)) e é mais lento/instável. Como o `next start` roda em modo de produção, defina `TEST_PROXY_RECORDER_ENABLED=true` no processo da aplicação para sua execução e2e.
:::

## registerProxyFetch (recomendado)

Uma linha no seu **root layout** marca cada `fetch` do lado do servidor — Server Components, Route Handlers, nos runtimes Node **e** Edge:

```typescript
// app/layout.tsx
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op em produção a menos que TEST_PROXY_RECORDER_ENABLED=true
```

Ele faz patch do `fetch` global para copiar o `x-test-rcrd-id` da requisição atual para as requisições de saída, para que o proxy consiga distinguir sessões de reprodução concorrentes. Chame-o a partir do root layout — **não** do `instrumentation.ts`, cujo contexto difere daquele que renderiza suas rotas no runtime Edge, então um patch ali silenciosamente nunca dispara.

## axios — registerProxyAxios

Se suas requisições do lado do servidor passam pelo axios, registre cada instância do lado do servidor uma vez:

```typescript
import { registerProxyAxios } from 'test-proxy-recorder/nextjs';

registerProxyAxios(axiosForServer);
```

Ele adiciona um interceptor de requisição que carimba o id (nunca tocando no `fetch` global), então fica imune à ressalva do servidor de desenvolvimento acima. No-op em produção / no navegador; idempotente por instância; nunca sobrescreve um id definido pelo chamador.

## Por chamada — createHeadersWithRecordingId

Sem patch, e funciona também sob `next dev`. Use-o para um único fetch, ou quando você preferir não fazer patch do `fetch` global:

```typescript
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

const res = await fetch('http://localhost:8100/api/data', {
  headers: createHeadersWithRecordingId(await headers(), {
    'Content-Type': 'application/json',
  }),
});
```

## Middleware (opcional)

Um `proxy.ts` (Next.js 16+, exportado como `proxy`) ou `middleware.ts` (15 e anteriores, exportado como `middleware`) chamando `setNextProxyHeaders` torna o id disponível via `next/headers`, mas **não marca as buscas de saída** — então não é obrigatório quando você usa um dos helpers acima. Use-o apenas se você já tem um middleware (auth, etc.) e ainda assim combine-o com um helper para fazer a marcação:

```typescript
// proxy.ts  (Next.js 16+)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response); // expõe o id; combine com um helper acima
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Veja a [referência da API](/docs/reference/api/readme/) para as assinaturas completas dos helpers de `test-proxy-recorder/nextjs`. Um projeto Edge completo e executável fica no [exemplo de Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge).

## Cache e ISR

Não desative o cache para os testes — o recorder funciona com uma rota cacheada/ISR. Mas há uma regra que decide todo o design: **para reproduzir um fetch SSR, a página precisa executar esse fetch no momento da requisição.** Uma rota que serve HTML pré-renderizado ou um render cacheado obsoleto nunca faz o fetch, então o proxy não tem nada para servir e a asserção vê conteúdo obsoleto.

A forma de manter isso determinístico é cachear o fetch SSR com `next.revalidate` + `next.tags` no nível do fetch e depois invalidar sob demanda antes da asserção:

```tsx
// app/isr/page.tsx — sem `export const dynamic`, sem `export const revalidate`
const res = await fetch(`${BACKEND_URL}/todos`, {
  next: { revalidate: 30, tags: ['isr-todos'] },
});
```

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('isr-todos', 'max'); // o Next.js 16 exige o 2º argumento de perfil
```

```typescript
// e2e/isr.spec.ts
await page.request.post('/api/revalidate'); // purge forçado
await page.goto('/isr');                     // uma navegação — determinístico
await expect(page.getByTestId('todo-text')).toHaveCount(1);
```

O `revalidateTag` em uma entrada de cache de **fetch** é um *purge forçado*: a próxima leitura é um cache miss que bloqueia e refaz o fetch pelo proxy. Você precisa fazer o purge antes da navegação de reprodução porque o cache de dados sobrevive entre as fases de gravar → reproduzir de um único processo `next start` — caso contrário, a reprodução serve o cache da fase de gravação e nunca acessa o proxy (um falso positivo).

Durante os testes, o `fetch` com patch lê `headers()`, então a página renderiza dinamicamente e de fato executa o fetch. Em produção (recorder desativado), nada lê `headers()` e a página é ISR estática como de costume — o render dinâmico fica restrito aos testes e é intrínseco à gravação de um fetch SSR.

:::caution[Evite `unstable_cache` para isso]
O `unstable_cache` é *stale-while-revalidate*: o `revalidateTag` marca sua entrada como obsoleta, a próxima leitura retorna o valor obsoleto e regenera em **segundo plano**, então o valor novo chega depois da sua asserção — instável, mesmo em uma página `force-dynamic` e mesmo com uma requisição de aquecimento. Use `next.tags` no nível do fetch (um purge forçado) em vez disso.
:::

A revalidação sob demanda é privilegiada (ela purga o cache e força a regeneração), então proteja a rota com um segredo compartilhado — falhe de forma fechada se não estiver definido, compare em tempo constante e anexe o token a partir do teste via `use.extraHTTPHeaders` do Playwright, para que a spec nunca o manipule.

Veja o exemplo completo e executável (parte do [exemplo de Next.js 16](/pt-br/docs/reference/examples/#nextjs-16)):

- [`app/isr/page.tsx`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/isr/page.tsx) — a página cacheada (`next.tags` no nível do fetch)
- [`app/api/revalidate/route.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/app/api/revalidate/route.ts) — como proteger o `revalidateTag`: falha fechada + comparação de segredo em tempo constante
- [`e2e/isr.spec.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/e2e/isr.spec.ts) — invalide e faça uma navegação; afirma que a chamada de revalidação teve sucesso
- [`playwright.config.ts`](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/playwright.config.ts) — carrega o `.env` e anexa o segredo via `extraHTTPHeaders`

## Scripts do package.json

Inicie os serviços a partir de scripts, não do `playwright.config.ts`:

```json
{
  "scripts": {
    "mock": "node mock-backend/server.mjs",
    "proxy": "test-proxy-recorder http://localhost:3002 -p 8100 -d ./e2e/recordings",
    "start:all": "concurrently \"pnpm mock\" \"pnpm proxy\" \"pnpm build && next start --port 3000\""
  }
}
```

Um projeto completo e executável fica no [exemplo de Next.js 16](/pt-br/docs/reference/examples/#nextjs-16).
