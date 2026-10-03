---
title: 'Configuração do Playwright: grave e reproduza cada teste'
description: Grave e reproduza chamadas de API em testes do Playwright com o test-proxy-recorder, usando o hook de sessão before(), o teardown global recomendado e arquivos de gravação por teste.
sidebar:
  label: Playwright
i18nSource: docs/integrations/playwright.md
i18nSourceBlob: 26b8b462ae4153046421443a751392892c37c34b
---

## `playwrightProxy.before(page, testInfo, mode, options?)`

Chame isso no início de cada teste (ou em um `beforeEach` / fixture de page). Ele define o modo do proxy para a sessão e, se `url` for fornecido, configura a gravação HAR para requisições do lado do navegador.

```typescript
await playwrightProxy.before(page, testInfo, 'replay', {
  // url: padrão para requisições do lado do navegador a gravar/reproduzir via HAR.
  //
  // Use o domínio REAL da API externa — não a URL do proxy.
  // Exemplos:
  //   /api\.example\.com/           — sua própria API
  //   /x\.com/                      — grava todo o tráfego de navegador de x.com (testes de extensão do Chrome)
  //   /cognito-.*amazonaws\.com/    — autenticação de terceiros
  url: /api\.example\.com/,
});
```

**Padrão de `url`:** corresponde ao domínio externo real que o navegador chama. No modo record as requisições vão para a API real e são salvas em um arquivo `.har`. No modo replay elas são servidas a partir desse arquivo — sem necessidade de rede. Este padrão **não** aponta para o proxy (`localhost:8100`).

**Exceção — aplicações full-stack:** quando o navegador também chama `localhost:8100` (porque o frontend está configurado com a URL do proxy como sua base de API), use `/localhost:8100/` como o padrão. Essas requisições do navegador passam então pelo proxy, que as grava no `.mock.json` do teste e as reproduz a partir dele; assim, uma requisição sem gravação recebe o 404 do proxy em vez de ser abortada pelo HAR (veja a [correspondência de requisições na reprodução](/pt-br/docs/getting-started/how-it-works/#replay-matching)).

Os nomes dos arquivos de gravação são derivados dos nomes dos testes (`"create a user"` → `create-a-user.mock.json` / `.har`).

## Teardown global (recomendado) {#global-teardown-recommended}

```typescript
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalTeardown: './e2e/global-teardown.ts',
});
```

O `teardown()` redefine o proxy para `transparent` e executa a passada de [remoção](/pt-br/docs/guides/secret-redaction/) do HAR. Não o chame em um hook `afterAll` por teste sob `fullyParallel` — veja a [FAQ](/pt-br/docs/reference/faq/#parallel-replay) para entender por que isso quebra a reprodução em paralelo.

## Arquivos de gravação

```text
e2e/recordings/
  my-test.mock.json   # lado do servidor (proxy) — buscas SSR
  my-test.har         # lado do cliente (HAR)   — buscas do navegador
```
