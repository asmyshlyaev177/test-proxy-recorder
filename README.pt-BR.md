<!-- i18n:start -->
[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Русский](./README.ru.md) · [Español](./README.es.md) · Português (BR) · [Français](./README.fr.md) · [Tiếng Việt](./README.vi.md)
<!-- i18n:meta locale=pt-BR source=README.md source-blob=ab07eba11b40520200d2a07622c0c8cf4933d352 status=translated -->
<!-- i18n:end -->

# test-proxy-recorder

> **VCR para Playwright** — grave as respostas reais da API uma vez e reproduza-as de forma determinística na CI. Cobre SSR do Next.js e do TanStack Start, tráfego do navegador e WebSocket. Sem backend, sem mocks escritos à mão.

[![GitHub stars](https://img.shields.io/github/stars/asmyshlyaev177/test-proxy-recorder?style=social)](https://github.com/asmyshlyaev177/test-proxy-recorder/stargazers)
[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![CI](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml/badge.svg)](https://github.com/asmyshlyaev177/test-proxy-recorder/actions/workflows/test.yml)
[![node](https://img.shields.io/node/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/w7rgYbY5zz)
[![Available for hire](https://img.shields.io/badge/available%20for%20hire-senior%20react%20engineer-2ea44f?style=flat-square)](https://asmyshlyaev177.dev)

<p align="center">
  <img src="./assets/demo-sm.gif" alt="Gravando respostas reais da API e depois reproduzindo-as na CI com o backend desligado" width="800">
</p>

```text
                Record mode                          Replay mode

  App ──> Proxy ──> Real API            App ──> Proxy ──> Disk
            │                                         │
            └──> saves to disk                        └──> serves saved responses
                 (.mock.json)                              (.mock.json)
```

## Por quê

Toda execução e2e instável tem a mesma causa raiz: a rede. Isto grava o tráfego real uma vez e depois o reproduz byte por byte na CI — para que os testes passem com o backend desligado.

- **Sem backend na CI** — reproduza a partir do disco, sem rede.
- **Sem mocks manuais** — capture interações reais, nunca escreva fixtures à mão.
- **SSR + navegador + WebSocket** — grave de onde quer que as requisições se originem.

## Comparação

O test-proxy-recorder é aquele que grava tráfego **real** em SSR, navegador e WebSockets sem mocks escritos à mão — essa combinação é a lacuna que os outros deixam em aberto.

| Recurso | **test-proxy-recorder** | `routeFromHAR` | MSW | Polly.js | playwright-network-cache | Mocky Balboa |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Gravar tráfego real | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Lado do servidor (SSR) | ✅ | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| Lado do navegador | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Nativo do Playwright | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Mantido | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

> ⚠️ O Polly.js intercepta o HTTP do Node, então mockar SSR é possível dentro do processo da aplicação, mas não como parte de uma execução do Playwright. O MSW e o Mocky Balboa também reproduzem respostas reais — mas você escreve os mocks à mão em vez de gravá-los.

Veja a [comparação completa na documentação](https://test-proxy-recorder.dev/docs/#comparison) — incluindo quando optar por outra ferramenta.

## Início rápido

**Caminho mais rápido — entregue ao seu agente de codificação de IA.** Copie isto, troque pela URL do seu backend e cole no Claude Code / Cursor / etc. (ele executa o `init` e conclui a configuração):

```text
# Configure o test-proxy-recorder para testes de ponta a ponta neste projeto e siga as instruções que o `init` imprime. Execute estes comandos:
  npm install --save-dev test-proxy-recorder
  npx @tanstack/intent@latest install
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
# Depois complete as etapas que o init imprime: aponte a URL base da API da aplicação para o proxy apenas em dev/teste, marque as buscas do lado do servidor (Next.js), adicione um smoke test e verifique gravar → reproduzir.
```

Prefere configurar à mão:

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

O `init` gera tudo de forma não destrutiva: a config do proxy, uma fixture do Playwright, um teardown global, scripts no `package.json` e (no Next.js) conecta a marcação das buscas SSR ao seu root layout via `registerProxyFetch()`. Ele termina imprimindo um prompt de agente de IA sob medida para as etapas específicas da aplicação que ele não consegue adivinhar.

A única coisa que o `init` não consegue adivinhar é qual variável de ambiente guarda a URL base da sua API. Aponte-a para o proxy quando o recorder estiver habilitado e para o backend real caso contrário — o proxy nunca roda em produção:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // endereço do proxy vindo do `init`
```

Depois defina `MODE = 'record'`, execute uma vez contra a API real, mude para `'replay'` e faça commit de `e2e/recordings/`. A CI agora roda com o backend desligado.

Passo a passo completo: [início rápido](https://test-proxy-recorder.dev/docs/getting-started/quick-start/) · [configuração manual](https://test-proxy-recorder.dev/docs/getting-started/manual-setup/).

> **Isso acabou de economizar uma tarde inteira de mocks escritos à mão?**
> Uma [⭐ no GitHub](https://github.com/asmyshlyaev177/test-proxy-recorder) leva um segundo e é assim que a próxima pessoa lutando contra testes e2e instáveis encontra isto. Sou um mantenedor solo e leio cada estrela como um sinal para continuar.

## Exemplos

Aplicações completas e funcionais em [`apps/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps), cada uma com seu próprio README:

- [Next.js 16](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs16) — chat com SSR + navegador + WebSocket
- [Next.js Edge runtime](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-nextjs-edge) — `registerProxyFetch` para reprodução concorrente
- [TanStack Start](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-tanstack-start) — SSR + navegador, TanStack Query, ISR, WebSocket e um login Cognito real
- [Chrome extension](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-extension) — somente navegador, reproduzida offline
- [Crypto ticker](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-websocket) — feed de WebSocket de terceiros
- [Authenticated app](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/apps/example-auth-cognito) — login Cognito real, API protegida reproduzida

## Documentação

Todo o resto fica em [test-proxy-recorder.dev/docs](https://test-proxy-recorder.dev/docs/): [como funciona](https://test-proxy-recorder.dev/docs/getting-started/how-it-works/), [CLI](https://test-proxy-recorder.dev/docs/guides/cli/), [config](https://test-proxy-recorder.dev/docs/guides/config/), [remoção de segredos](https://test-proxy-recorder.dev/docs/guides/secret-redaction/), [integração com Next.js](https://test-proxy-recorder.dev/docs/integrations/nextjs/), [integração com TanStack Start](https://test-proxy-recorder.dev/docs/integrations/tanstack-start/), [referência da API](https://test-proxy-recorder.dev/docs/reference/api/readme/), [FAQ](https://test-proxy-recorder.dev/docs/reference/faq/).

Usando um agente de codificação de IA? O `npx @tanstack/intent@latest install` adiciona skills para que ele gere código de configuração correto. Veja o [guia de skills para agentes de IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

## Requisitos

- Node.js >= 20.0.0
- `@playwright/test` >= 1.0.0 (dependência peer)

## Feedback e contribuição

Isto é construído e mantido em aberto por uma pessoa, e cada feedback orienta o que será construído a seguir:

- **[⭐ Estrelar o repositório](https://github.com/asmyshlyaev177/test-proxy-recorder)** — a forma mais rápida de apoiar, e realmente ajuda outras pessoas a descobri-lo.
- **Esbarrou em algum problema ou teve uma ideia?** [Abra uma issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues/new) ou diga oi no [Discord](https://discord.gg/w7rgYbY5zz) — até um "isso me confundiu" de uma linha vale ouro.
- **Quer contribuir?** PRs são bem-vindos. 

## Skill de IA

Usando um agente de codificação de IA (Claude Code, Cursor, Copilot, …)? A biblioteca inclui skills do [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) para que o agente gere código de configuração correto. Instale o pacote e depois escreva a orientação para o agente:

```bash
npm install --save-dev test-proxy-recorder
npx @tanstack/intent@latest install
```

O `install` adiciona orientação de descoberta de skills à config do seu agente (`CLAUDE.md`, `.cursorrules`, …); o agente carrega as skills `proxy-setup`, `nextjs-ssr` e `tanstack-start` sob demanda. Liste ou carregue-as diretamente com `npx @tanstack/intent@latest list` e `npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup`. Guia completo: [skills para agentes de IA](https://test-proxy-recorder.dev/docs/reference/ai-agent-skills/).

Os fontes das skills ficam em [`packages/test-proxy-recorder/skills/`](packages/test-proxy-recorder/skills/).

## Contrate-me

Sou **Aleksandr Smyshliaev** — autor e mantenedor desta ferramenta. Engenheiro
frontend sênior (React / Next.js / TypeScript, 8+ anos) e **disponível para
trabalho remoto em tempo integral agora**.

Este projeto existe porque passei anos corrigindo suites de teste instáveis de
outras pessoas. É o tipo de trabalho em que sou melhor: a infraestrutura
entediante que decide se uma base de código continua agradável seis meses
depois.

- **Melhor em** — bibliotecas de componentes, gerenciamento de estado e suites
  de teste que sobrevivem a uma refatoração.
- **Também meus** —
  [react-horizontal-scrolling-menu](https://github.com/asmyshlyaev177/react-horizontal-scrolling-menu)
  (~84 mil instalações semanais),
  [state-in-url](https://github.com/asmyshlyaev177/state-in-url) (estado de URL
  tipado), [llm-queue](https://github.com/asmyshlyaev177/llm-queue).
- **Onde** — Tbilisi, Geórgia (GMT+4), sobreposição total com CET. Entidade de
  contratante registrada, então o engajamento B2B não precisa de configuração
  de employer-of-record.
- **Contato** — [asmyshlyaev177.dev](https://asmyshlyaev177.dev) ·
  [asmyshlyaev177@gmail.com](mailto:asmyshlyaev177@gmail.com) ·
  [LinkedIn](https://linkedin.com/in/asmyshlyaev177) · Telegram @asmyshlyaev177

## Licença

MIT
