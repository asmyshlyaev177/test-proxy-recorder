---
title: Remoção de segredos
description: A remoção fica ativa por padrão — Authorization, Cookie e Set-Cookie são removidos das gravações antes de chegarem ao disco. Adicione padrões de header e de corpo, cookies na allow-list ou remova programaticamente.
i18nSource: docs/guides/secret-redaction.md
i18nSourceBlob: 1b03e54f96e418edf62ea8dd611fcc2fc4f30bbc
---

As gravações são commitadas no git, então os segredos são removidos antes de qualquer coisa ser gravada no disco. A remoção fica **ativa por padrão**; o proxy substitui os valores destes headers de requisição/resposta por `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

Isso é seguro: a correspondência na reprodução ignora esses headers, então a remoção nunca quebra a reprodução. Ela se aplica a gravações `.mock.json`, gravações WebSocket e arquivos `.har`. Para desativar a remoção, passe `--no-redact` na CLI ou defina `redaction: false` na [config](/pt-br/docs/guides/config/).

Quando apenas *alguns* cookies são sensíveis, coloque os inofensivos na allow-list por nome (por exemplo, um cookie `theme` ou de teste A/B). Cookies na allow-list mantêm seus valores dentro de `Cookie`/`Set-Cookie`; todos os outros cookies continuam removidos.

:::note[Remoção de segredos em arquivos `.har`]
Os arquivos `.har` são gravados pelo `routeFromHAR` do Playwright, não pelo proxy, então são processados em uma passada separada. O `playwrightProxy.teardown()` reescreve cada `.har` no diretório de gravações usando a **mesma config de remoção** do proxy (headers, `allowCookies` e `bodyPatterns` se aplicam, tanto aos headers quanto aos arrays `cookies` parseados). Isso roda a partir do seu **`globalTeardown`** do Playwright — então a remoção de HAR requer um `globalTeardown` que chame `playwrightProxy.teardown()` (a [configuração recomendada](/pt-br/docs/integrations/playwright/#global-teardown-recommended), gerada pelo `init`).

Ela não pode rodar por teste: o Playwright descarrega um HAR quando seu context fecha, mas não espera os handlers de fechamento, então remover nesse ponto corre contra a saída do processo e pode truncar o arquivo. O teardown busca a config em `/__control` (o proxy precisa estar em execução; se inacessível, os padrões de header embutidos ainda se aplicam), só reescreve arquivos que realmente mudou e deixa os corpos de resposta base64 intactos. Para defesa em profundidade, grave mesmo assim com credenciais de teste de vida curta e revise os HARs antes de commitar — veja o padrão de autenticação recomendado abaixo.
:::

## Padrão de autenticação recomendado

Para manter o fluxo de login e as credenciais totalmente fora das gravações, execute a autenticação em um **projeto de setup** do Playwright com o proxy no modo `transparent`, persista o `storageState` em um `auth-state.json` **ignorado pelo git** e reutilize-o nos seus testes. As requisições gravadas então carregam apenas os headers de sessão (removidos), nunca o login.

Veja o [exemplo de aplicação autenticada](/pt-br/docs/reference/examples/#authenticated-app) para uma configuração funcional contra um provedor de autenticação real.

## Ajustando o que é removido

Os headers padrão sempre se aplicam (enquanto a remoção estiver ativa); você pode acrescentar a eles.

### Flags da CLI

- `--no-redact` — desativa a remoção de segredos (ativa por padrão).
- `--redact` — ativa a remoção de segredos; só é necessário para reativar quando a config define `redaction: false`.
- `--redact-headers <names>` — nomes de header extras, separados por vírgula, a remover (mesclados com os padrões).
- `--redact-body <patterns>` — padrões regex separados por vírgula a remover dos corpos de requisição/resposta.
- `--allow-headers <names>` — nomes de header, separados por vírgula, isentos de remoção (por exemplo `set-cookie`).
- `--allow-cookies <names>` — nomes de cookie, separados por vírgula, a manter sem remoção dentro de `Cookie`/`Set-Cookie`.

```bash
# A remoção já está ativa; remova também um header de API-key e tokens "sk_live_...", mantenha o cookie theme
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Programático

Ao construir o `ProxyServer` diretamente:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passar este objeto ativa a remoção; passe `false` (ou nada) para mantê-la desativada.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // headers extras, mesclados com os padrões
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes substituídos nos corpos de requisição/resposta
  allowHeaders: ['set-cookie'],        // nunca remova estes headers
  allowCookies: ['theme', 'locale'],   // mantenha estes cookies dentro de Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // padrão
});
```

O `redactSession(session, config)` também é exportado caso você queira remover segredos de gravações existentes por conta própria.
