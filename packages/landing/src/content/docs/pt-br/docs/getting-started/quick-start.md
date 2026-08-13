---
title: Início rápido
description: Configure o test-proxy-recorder com um único comando init — melhor conduzido por um agente de IA. Aponte sua API para o proxy, grave uma vez e reproduza na CI.
i18nSource: docs/getting-started/quick-start.md
i18nSourceBlob: 1f0c3114d600fcebf0696c67788cd60c9b6558db
---

## Configurar com um agente de IA (recomendado)

Copie isto e cole no seu agente de codificação de IA (Claude Code, Cursor, …):

```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install

Then run init, passing this project's backend API base URL as the target — find
it yourself from the app's env/config (the URL the app calls in dev); don't
assume the default:

  npx test-proxy-recorder init <your-backend-api-url> --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```

O agente adiciona as skills, gera tudo com o `init` (config, fixture do Playwright, teardown, scripts e — no Next.js — `registerProxyFetch()` no seu root layout) e depois conclui a configuração que o `init` não consegue adivinhar a partir do prompt que o `init` imprime. Quer uma configuração pronta para copiar? Veja os [exemplos](/pt-br/docs/reference/examples/).

## Ou configure à mão

O `init` escreve tudo e não sobrescreve nada:

```text
test-proxy-recorder.config.ts
playwright.config.ts
app/layout.tsx           # somente Next.js — adiciona registerProxyFetch() para marcar buscas SSR
e2e/fixtures.ts          # gravar vs reproduzir
e2e/global-teardown.ts
package.json             # + scripts proxy / test:e2e
```

### 1. Aponte a API da sua aplicação para o proxy

A única coisa que o `init` não consegue adivinhar: qual variável de ambiente guarda a URL base da sua API. Aponte-a para o proxy quando o recorder estiver habilitado e para o backend real caso contrário — o proxy nunca roda em produção:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // endereço do proxy vindo do `init`
```

### 2. Marque as buscas do lado do servidor (somente Next.js)

As requisições do navegador já carregam o id da sessão de gravação (o Playwright o define). Para buscas do lado do servidor (SSR, Server Components), adicione uma linha ao seu root layout para que elas também sejam marcadas — o `init` faz isso por você:

```tsx
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

Usando axios para chamadas do lado do servidor? Use `registerProxyAxios(instance)` em vez disso.
Grave contra um build de produção (`next build && next start`), não `next dev`.
Aplicações somente de navegador (SPA, extensão) podem pular esta etapa.

### 3. Grave uma vez, reproduza para sempre

```bash
# fixtures.ts: MODE = 'record' — capture respostas reais
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — depois faça commit das gravações
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

A CI agora reproduz com o backend desligado — as mesmas respostas todas as vezes.

---

Mais detalhes: [configuração manual](/pt-br/docs/getting-started/manual-setup/) · [como funciona](/pt-br/docs/getting-started/how-it-works/) · [skills para agentes de IA](/pt-br/docs/reference/ai-agent-skills/).
