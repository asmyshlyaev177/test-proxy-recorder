---
title: Cómo funciona
description: test-proxy-recorder graba tráfico mediante dos mecanismos — un proxy para peticiones del lado del servidor y HAR para peticiones del lado del navegador. Úsalos juntos o por separado.
---

test-proxy-recorder admite dos mecanismos de grabación según dónde se originan tus peticiones. Ambos pueden usarse juntos o de forma independiente.

| Mecanismo | Qué graba | Caso de uso |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Peticiones del lado del servidor (fetches SSR de Next.js, etc.) | Apps full-stack donde el servidor llama a la API |
| **HAR** (`.har`) | Peticiones del lado del navegador (`fetch` del navegador, extensiones, SPAs) | SPAs, extensiones de Chrome, APIs de terceros |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Cada modo se establece por sesión de prueba. En modo **record** el proxy reenvía al backend real y guarda las respuestas; en modo **replay** sirve las respuestas guardadas desde disco; en modo **transparent** reenvía sin grabar. Mira el [endpoint de control](/es/docs/guides/control-endpoint/) para saber cómo se cambian los modos.
