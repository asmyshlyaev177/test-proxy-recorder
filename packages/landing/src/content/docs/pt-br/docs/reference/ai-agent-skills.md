---
title: Skills para agentes de IA
description: Instale as skills do test-proxy-recorder para que os agentes de codificação de IA (Claude Code, Cursor, Copilot) gerem código correto de configuração de proxy, fixture e SSR.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

Se você usa um agente de codificação de IA (Claude Code, Cursor, Copilot e similares), configure o carregamento de skills para que o agente gere código de configuração correto. As skills são incluídas dentro do pacote `test-proxy-recorder` via [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) e viajam com ele nas suas atualizações normais de gerenciador de pacotes.

**1. Instale a biblioteca** (as skills são descobertas a partir dos pacotes instalados):

```bash
npm install --save-dev test-proxy-recorder
```

**2. Escreva a orientação para o agente** — o `install` adiciona instruções de descoberta à config do seu agente (`CLAUDE.md`, `.cursorrules`, etc.) para que o agente carregue skills de pacote correspondentes sob demanda:

```bash
npx @tanstack/intent@latest install
```

Passe `--map` se você preferir escrever mapeamentos explícitos de tarefa para skill na config do seu agente em vez de orientação de descoberta genérica.

O agente então saberá a configuração correta de proxy/fixture, o fluxo de gravar vs. reproduzir e os padrões de header de SSR do Next.js sem precisar de orientação.

## As skills

O `test-proxy-recorder` inclui estas skills:

- **`proxy-setup`** — a CLI do proxy, scripts do `package.json`, o `webServer` do `playwright.config.ts`, fixtures por teste, modos record/replay/transparent, remoção de segredos e o ciclo gravar-uma-vez → commit → reproduzir-na-CI.
- **`nextjs-ssr`** — marcar buscas do lado do servidor com `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, a ressalva de build-and-start vs `next dev` e por que o middleware é opcional.
- **`tanstack-start`** — marcar loaders, server functions e server routes do TanStack Start, a ressalva de build vs `vite dev`, a divisão de URL de API servidor-vs-navegador, prefetch SSR do TanStack Query e o padrão de autenticação real.

Liste o que está disponível nos seus pacotes instalados ou carregue um diretamente:

```bash
npx @tanstack/intent@latest list                          # mostra as skills descobríveis
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## Mantendo as skills (para contribuidores)

As skills de agente ficam em [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Verifique-as periodicamente — e sempre que a API da biblioteca ou os exemplos mudarem:

```bash
npx @tanstack/intent@latest validate   # verificações de estrutura/formato/limite de linhas (execute antes de commitar edições de skills)
npx @tanstack/intent@latest stale      # sinaliza divergência de versão em relação à biblioteca publicada — re-revise as skills que ele lista
```

O `validate` precisa passar; o `stale` é consultivo — quando ele relatar divergência após um lançamento, re-revise o conteúdo da skill afetada (e incremente sua `library_version`).
