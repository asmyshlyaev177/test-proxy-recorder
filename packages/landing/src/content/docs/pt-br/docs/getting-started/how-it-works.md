---
title: 'Como funcionam a gravação e a reprodução: um proxy para SSR, HAR para o navegador'
description: O test-proxy-recorder grava tráfego por meio de dois mecanismos, um proxy para requisições do lado do servidor e HAR para requisições do lado do navegador, usados em conjunto ou separadamente.
sidebar:
  label: Como funciona
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 32bdd456b9abbf2556d3314806353dd2cc86c971
---

O test-proxy-recorder oferece suporte a dois mecanismos de gravação, dependendo de onde suas requisições se originam. Ambos podem ser usados em conjunto ou de forma independente.

| Mecanismo | O que ele grava | Caso de uso |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Requisições do lado do servidor (buscas SSR do Next.js etc.) | Aplicações full-stack onde o servidor chama a API |
| **HAR** (`.har`) | Requisições do lado do navegador (`fetch` do navegador, extensões, SPAs) | SPAs, extensões do Chrome, APIs de terceiros |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Cada teste define o modo quando começa, e o proxy mantém um único modo para todas as requisições que recebe, então testes que rodam ao mesmo tempo o compartilham. No modo **record** o proxy encaminha para o backend real e salva as respostas; no modo **replay** ele serve as respostas salvas a partir do disco, e o id de cada teste escolhe a gravação desse teste; no modo **transparent** ele encaminha sem gravar. O proxy inicia no modo transparent, então uma aplicação que passa por ele fora dos testes fala com o backend normalmente. Veja o [endpoint de controle](/pt-br/docs/guides/control-endpoint/) para saber como os modos são trocados.

## Correspondência de requisições na reprodução {#replay-matching}

O proxy e o arquivo HAR procuram uma resposta gravada de formas diferentes.

| Na reprodução | Proxy (`.mock.json`) | HAR (`.har`) |
| --- | --- | --- |
| Correspondência por | Método, caminho e um hash MD5 da query string. O corpo não é comparado. | Método e URL, mais o corpo no caso de um `POST` ([regras do Playwright](https://playwright.dev/docs/mock#replaying-from-har)). |
| A mesma requisição de novo | A próxima gravação, seguindo a ordem de gravação. | A entrada com mais headers correspondentes. A ordem de gravação é ignorada. |
| Sem gravação | Um 404 com um corpo JSON que identifica a requisição, e o `playwrightProxy.before()` fecha a página para que o teste falhe na hora (`failOnMissingRecording: false` desativa isso). | A requisição é abortada. |
| Acesso à API real | Só no modo `transparent`. | Só para requisições que não correspondem a `url`. |

### Requisições do lado do servidor (proxy)

A chave é formada pelo método, pelo caminho e pelos primeiros 16 caracteres hexadecimais do hash MD5 da query string. `GET /todos?page=2` tem a chave `GET_todos_46589c7afd19c014.json`, então uma query string com qualquer diferença, mesmo só na ordem dos parâmetros, gera uma chave diferente.

Chamadas com a mesma chave são servidas na ordem em que foram gravadas. Uma chamada além da última gravação recebe de novo a última resposta, e o proxy registra no log `[REPLAY WARNING] All N recordings already served for <key> (session: <id>), reusing last one`.

Uma requisição sem gravação não chega à API real. O proxy registra linhas `[REPLAY ERROR]` no log e responde com um 404:

```json
{
  "error": "No recording found",
  "message": "No recording found for GET_todos_46589c7afd19c014.json at GET localhost:8100/todos?page=2",
  "key": "GET_todos_46589c7afd19c014.json",
  "sessionId": "todos__shows-the-list"
}
```

O proxy só envia requisições ao backend real no modo `transparent`. Uma execução de reprodução chega a esse modo de duas formas: o `playwrightProxy.teardown()` roda enquanto ainda há testes em andamento, ou o timeout da sessão (120000 ms por padrão) se esgota antes da próxima chamada a `playwrightProxy.before()`. A [FAQ](/pt-br/docs/reference/faq/#parallel-replay) explica as duas.

### Requisições do navegador (HAR)

Quando você passa `url`, o `playwrightProxy.before()` entrega as requisições do navegador ao roteamento HAR do Playwright:

```typescript
await page.routeFromHAR(harPath, { url, update: mode === 'record', updateContent: 'embed' });
```

A opção `notFound` do Playwright tem `'abort'` como padrão, então, na reprodução, uma requisição que corresponde a `url` mas não está no `.har` é abortada. Requisições que não correspondem a `url` não são interceptadas. Elas vão para a rede real, tanto na gravação quanto na reprodução.

As requisições ao próprio proxy (`localhost:8100`) são a exceção. O `before()` registra um handler próprio para elas depois do handler do HAR, e o Playwright executa primeiro o handler registrado por último. Esse handler as repassa ao proxy, que as reproduz a partir do `.mock.json`, como faz com as requisições do lado do servidor.
