---
title: 'Como funcionam a gravação e a reprodução: um proxy para SSR, HAR para o navegador'
description: O test-proxy-recorder grava tráfego por meio de dois mecanismos, um proxy para requisições do lado do servidor e HAR para requisições do lado do navegador, usados em conjunto ou separadamente.
sidebar:
  label: Como funciona
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: 26b907ff9c82df698a55827441e0b4b432a42262
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
| Correspondência por | Método, caminho e um hash MD5 da query string. O corpo não é comparado. | Método, URL e corpo, e depois as entradas que compartilham mais headers de requisição, já que a mesma URL e o mesmo corpo podem ser operações diferentes, distinguidas por um header. Se nenhuma entrada tem esse corpo, a correspondência passa a ser só por método e URL, e o delimitador (boundary) multipart é ignorado. |
| A mesma requisição de novo | A próxima gravação, seguindo a ordem de gravação. | A próxima gravação, seguindo a ordem de gravação, com uma regra para escritas (abaixo). |
| Sem gravação | Um 404 com um corpo JSON que identifica a requisição, e o `playwrightProxy.before()` fecha a página para que o teste falhe na hora (`failOnMissingRecording: false` desativa isso). | A requisição é abortada e `[Client-Side Replay] No recorded response for <method> <url>` é registrado no log. |
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

Quando você passa `url`, o `playwrightProxy.before()` grava as requisições do navegador correspondentes com o gravador HAR do Playwright:

```typescript
await page.routeFromHAR(harPath, { url, update: true, updateContent: 'embed' });
```

A reprodução é feita por um handler `page.route()` da própria biblioteca sobre esse arquivo, não pelo `page.routeFromHAR()`. A reprodução do Playwright responde a toda repetição de uma requisição com a primeira entrada correspondente ([microsoft/playwright#18288](https://github.com/microsoft/playwright/issues/18288)), então um `GET` depois de um `POST` mostrava a lista de antes do `POST`. Em vez disso, o handler entrega cada gravação uma única vez, na ordem de gravação, e só reutiliza uma quando a página pede mais vezes do que pediu durante a gravação. Uma regra ordena as leituras em relação às escritas. Depois que uma escrita em um caminho (qualquer método exceto `GET`, `HEAD` e `OPTIONS`, então uma query GraphQL conta) é reproduzida, uma leitura desse caminho ou de um caminho abaixo dele prefere as cópias gravadas depois da escrita. Uma leitura sem cópias restantes antes da próxima escrita desse tipo reutiliza a mais recente anterior a essa escrita. A regra mantém a reprodução correta quando a aplicação lê um número de vezes diferente do que leu durante a gravação, como um fetch duplo no modo estrito do React. Um redirecionamento gravado é seguido dentro do `.har`, porque a requisição seguinte do navegador nunca chega ao `page.route()`: um fetch recebe a resposta final, e uma navegação é enviada ao destino do redirecionamento.

Uma requisição que corresponde a `url` mas não está no `.har` é abortada. Requisições que não correspondem a `url` não são interceptadas, e no modo `transparent` nenhuma é. Elas vão para a rede real.

As requisições ao próprio proxy (`localhost:8100`) são a exceção. O `before()` registra um handler próprio para elas depois do handler do HAR, e o Playwright executa primeiro o handler registrado por último. Esse handler as repassa ao proxy, que as reproduz a partir do `.mock.json`, como faz com as requisições do lado do servidor.
