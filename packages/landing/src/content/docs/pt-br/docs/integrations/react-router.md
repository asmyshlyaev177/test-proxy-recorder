---
title: React Router / Remix
description: Uma integração de primeira classe com React Router 7 (modo framework) e Remix para o test-proxy-recorder está no roadmap. Até ela chegar, encaminhe o header de sessão de gravação a partir dos loaders e actions à mão.
i18nSource: docs/integrations/react-router.md
i18nSourceBlob: 84a70df0fa049d7fe27235ed2884156c7bb75cfa
---

:::caution[No roadmap]
Um adaptador de primeira classe para o modo framework do React Router 7 (o que "Remix" significa na prática hoje) está planejado, mas ainda não foi lançado. Esta página descreve o padrão manual que funciona hoje e será substituída pelo guia dedicado assim que o adaptador chegar. Quer mais cedo? [Abra uma issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

Os loaders e actions do React Router 7 rodam no servidor, então suas chamadas `fetch` passam pelo proxy sem um contexto de navegador — a mesma situação do [SSR do Next.js](/pt-br/docs/integrations/nextjs/). O proxy precisa do header `x-test-rcrd-id` nessas requisições do lado do servidor para atribuí-las à sessão de gravação correta.

## Padrão manual (funciona hoje)

Cada loader/action recebe a `request` de entrada. Leia o header de id de gravação dela e o encaminhe em qualquer `fetch` do lado do servidor:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Aponte a base da API para o proxy apenas em dev/teste.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Aponte a URL base do seu backend para o proxy (`http://localhost:8100`) apenas em dev/teste, exatamente como na [configuração manual](/pt-br/docs/getting-started/manual-setup/). As requisições do lado do navegador continuam sendo tratadas pelo mecanismo HAR do `playwrightProxy.before()`.

Assim que o adaptador for lançado, isso se reduz a um único import de helper — acompanhe o progresso no [roadmap](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
