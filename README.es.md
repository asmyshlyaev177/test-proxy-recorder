<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Русский](./README.ru.md) · Español · [Português (BR)](./README.pt-BR.md) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=es source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **VCR para Playwright** — graba las respuestas reales de la API una vez y reprodúcelas de forma determinista en CI. Cubre el SSR de Next.js y TanStack Start, el tráfico del navegador y WebSocket. Sin backend, sin mocks escritos a mano.

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Grabando respuestas reales de la API y luego reproduciéndolas en CI con el backend apagado" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## Por qué

Toda ejecución e2e flaky tiene la misma causa raíz: la red. Esto graba el tráfico real una vez y luego lo reproduce byte a byte en CI — así las pruebas pasan con el backend apagado.

- **Sin backend en CI** — reproduce desde el disco, sin red.
- **Sin mocks manuales** — captura interacciones reales, nunca escribas fixtures a mano.
- **SSR + navegador + WebSocket** — graba desde donde se originen las peticiones.

## Comparación

test-proxy-recorder es la que graba tráfico **real** a través de SSR, navegador y WebSockets sin mocks escritos a mano — esa combinación es el hueco que las demás dejan abierto.

| Característica | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Graba tráfico real | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Lado del servidor (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Lado del navegador | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Nativo de Playwright | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Mantenido | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ Polly.js intercepta el HTTP de Node, así que el mocking de SSR es posible dentro del proceso de la app, pero no como parte de una ejecución de Playwright. MSW y Mocky Balboa también reproducen respuestas reales — pero escribes los mocks a mano en lugar de grabarlos.

Mira la [comparación completa en la documentación](https://test-proxy-recorder.dev/docs/#comparison) — incluido cuándo recurrir a otra cosa.

## Inicio rápido

**La vía más rápida — dáselo a tu agente de codificación con IA.** Copia esto, cambia la URL de tu backend y pégalo en Claude Code / Cursor / etc. (ejecuta `init` y termina el cableado):

```text
# Configura test-proxy-recorder para pruebas end-to-end en este proyecto, luego sigue las instrucciones que imprime `init`. Ejecuta estos comandos:
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# Luego completa los pasos que imprime init: apunta la URL base de la API de la app al proxy solo en dev/test, etiqueta los fetch del lado del servidor (Next.js), añade un smoke test y verifica grabar → reproducir.
```

¿Prefieres cablearlo a mano?:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

`init` genera todo de forma no destructiva: la config del proxy, un fixture de Playwright, un teardown global, los scripts de `package.json` y (en Next.js) cablea el etiquetado de los fetch SSR en tu root layout vía `registerProxyFetch()`. Termina imprimiendo un prompt de agente de IA a medida para los pasos específicos de la app que no puede adivinar.

Lo único que `init` no puede adivinar es qué variable de entorno guarda la URL base de tu API. Apúntala al proxy cuando el grabador está activo, y al backend real en caso contrario — el proxy nunca se ejecuta en producción:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // dirección del proxy según `init`
```

Luego establece `MODE = 'record'`, ejecuta una vez contra la API real, cambia a `'replay'` y haz commit de `e2e/recordings/`. CI ahora se ejecuta con el backend apagado.

Guía completa: [inicio rápido](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [configuración manual](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **¿Acaba de ahorrarte una tarde de escribir mocks a mano?**
> Un [⭐ en GitHub](https://github.com/asmyshlyaev177/test-proxy-recorder) cuesta un segundo y es como la próxima persona que pelea con pruebas e2e flaky encuentra esto. Soy un mantenedor en solitario y leo cada estrella como una señal para seguir adelante.

## Ejemplos

Apps completas y funcionales en [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), cada una con su propio README:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — SSR + navegador + chat por WebSocket
- [Runtime Edge de Next.js](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — `registerProxyFetch` para reproducción concurrente
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + navegador, TanStack Query, ISR, WebSocket y un login real de Cognito
- [Extensión de Chrome](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — solo navegador, reproducida sin conexión
- [Ticker de cripto](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — feed de WebSocket de terceros
- [App autenticada](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — login real de Cognito, API protegida reproducida

## Documentación

Todo lo demás vive en [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/): [cómo funciona](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [config](https://test-proxy-recorder.dev/docs/guides/config/), [enmascaramiento de secretos](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [integración con Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [integración con TanStack Start](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [referencia de la API](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

¿Usas un agente de codificación con IA? `npx @tanstack/intent@latest install` añade skills para que genere código de configuración correcto. Mira la [guía de skills para agentes de IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Requisitos

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (dependencia de pares)

## Feedback y contribuciones

Esto lo construye y mantiene en abierto una sola persona, y cada comentario orienta lo que se construye a continuación:

- **[⭐ Estrella el repo](https://github.com/asmyshlyaev177/test-proxy-recorder)** — la forma más rápida de apoyarlo, y de verdad ayuda a que otros lo descubran.
- **¿Te topaste con una arista incómoda o tienes una idea?** [Abre un issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) o saluda en [Discord](https://discord.gg/w7rgYbY5zz) — incluso un «esto me confundió» de una línea vale oro.
- **¿Quieres contribuir?** Los PR son bienvenidos.

## Skill para IA

¿Usas un agente de codificación con IA (Claude Code, Cursor, Copilot, …)? La librería distribuye las skills de [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) para que el agente genere código de configuración correcto. Instala el paquete y luego escribe la guía del agente:

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

`install` añade la guía de descubrimiento de skills a tu config de agente (`CLAUDE.md`, `.cursorrules`, …); el agente carga las skills `proxy-setup`, `nextjs-ssr` y `tanstack-start` bajo demanda. Lístalas o cárgalas directamente con `npx @tanstack/intent@latest list` y `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`. Guía completa: [skills para agentes de IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

Las fuentes de las skills viven en [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/).

## Contrátame

Soy **Aleksandr Smyshliaev** — autor y mantenedor de esta herramienta. Ingeniero
frontend senior (React / Next.js / TypeScript, más de 8 años) y **disponible para
trabajo remoto a tiempo completo ahora mismo**.

Este proyecto existe porque pasé años arreglando las suites de pruebas flaky de
otras personas. Ese es el tipo de trabajo que mejor se me da: la infraestructura
aburrida que decide si una base de código sigue siendo agradable seis meses
después.

- **Se me da bien** — librerías de componentes, gestión de estado y suites de
  pruebas que sobreviven a un refactor.
- **También míos** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (~84k instalaciones semanales),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (estado de URL
  tipado), [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **Dónde** — Tbilisi, Georgia (GMT+4), con solapamiento completo con CET.
  Entidad de contratista registrada, así que un encargo B2B no necesita setup de
  employer-of-record.
- **Contáctame** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## Licencia

MIT
