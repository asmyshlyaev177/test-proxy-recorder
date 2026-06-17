---
title: Apps de ejemplo
description: Ejemplos completos y funcionales de test-proxy-recorder — SSR de Next.js, una extensión de Chrome, un ticker por WebSocket de terceros y una app autenticada reproducida sin backend.
---

Ejemplos completos y funcionales viven en [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps) — uno por mecanismo de grabación. Cada uno tiene su propio README con la configuración completa y el flujo de grabar/reproducir.

## Next.js 16 {#nextjs-16}

[`apps/example-nextjs16`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — una app de tareas de Next.js 16 con un backend mock, proxy y pruebas e2e de Playwright. Graba tanto fetches SSR (`.mock.json`) como fetches del navegador (`.har`), e incluye un chat por WebSocket contra el backend local. Mira su [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-nextjs16/README.md).

## Extensión de Chrome {#chrome-extension}

[`apps/example-extension`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — una extensión de Chrome real que llama a la API de X/Twitter desde un content script; las peticiones del navegador se graban en `.har` y se reproducen sin conexión, sin API en vivo ni cuenta en CI. Mira su [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-extension/README.md).

## Ticker de cripto — WebSocket de terceros {#websocket}

[`apps/example-websocket`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — un ticker de precio BTC-USD en vivo respaldado por el feed público de WebSocket de Binance. Graba el feed real una vez a través del proxy, luego reproduce precios deterministas en CI sin red ni cuenta de exchange. Mira su [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-websocket/README.md).

## App autenticada {#authenticated-app}

[`apps/example-auth-cognito`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — una app de Next.js que inicia sesión en un user pool **real de AWS Cognito**, luego graba/reproduce su API protegida. El login se mantiene en vivo en cada ejecución (nunca se graba); los datos protegidos se reproducen con el backend apagado, y el token de auth se redacta de las grabaciones. La integración son solo un puñado de archivos — mira su [README](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/apps/example-auth-cognito/README.md). Para el mismo patrón **sin cuenta en la nube**, mira [`apps/example-auth-mock`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-mock).
