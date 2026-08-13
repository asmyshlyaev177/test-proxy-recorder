---
title: Como funciona
description: O test-proxy-recorder grava tráfego por meio de dois mecanismos — um proxy para requisições do lado do servidor e HAR para requisições do lado do navegador. Use-os em conjunto ou de forma independente.
i18nSource: docs/getting-started/how-it-works.md
i18nSourceBlob: c82c75cbf1d14fc641da1da4d85b7713c5e612db
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

Cada modo é definido por sessão de teste. No modo **record** o proxy encaminha para o backend real e salva as respostas; no modo **replay** ele serve as respostas salvas a partir do disco; no modo **transparent** ele encaminha sem gravar. Veja o [endpoint de controle](/pt-br/docs/guides/control-endpoint/) para saber como os modos são trocados.
