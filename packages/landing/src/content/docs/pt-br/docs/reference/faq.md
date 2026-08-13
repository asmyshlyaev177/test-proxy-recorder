---
title: FAQ
description: Perguntas frequentes sobre o test-proxy-recorder — reprodução em paralelo, commitar gravações no git, o alvo do proxy para gravação HAR, o servidor de desenvolvimento do Next.js e a atualização das gravações.
i18nSource: docs/reference/faq.md
i18nSourceBlob: 35d6fcf35338b9b64fd4c7988beea62f0a7219d3
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

## Devo commitar as gravações no git?

Sim. As gravações precisam estar no git para que a CI possa reproduzi-las sem rede — **não** adicione `e2e/recordings` ao `.gitignore`. Para evitar que arquivos de gravação grandes inchem os diffs de PR, marque-os como binários no `.gitattributes`:

```text
/e2e/recordings/** binary
```

## O `<target-url>` do proxy importa para gravação somente de navegador (HAR)?

Não. Para gravação somente de navegador, o alvo é irrelevante — o processo do proxy só precisa estar em execução para que o endpoint `/__control` fique disponível para o gerenciamento de sessão. O alvo só importa quando as requisições do lado do servidor (SSR) também são roteadas pelo proxy.

## Posso gravar contra o servidor de desenvolvimento do Next.js?

Prefira `next build` + `next start` em vez de `next dev` para gravar e reproduzir. O servidor de desenvolvimento é lento e pode causar timeouts ou gravações instáveis.

## Como atualizo uma gravação?

Execute novamente no modo record (defina `MODE = 'record'` na sua fixture, ou `RECORD_MODE=1`) contra a API real, depois volte para replay e commite os arquivos atualizados em `e2e/recordings/`.
