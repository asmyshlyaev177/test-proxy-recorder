---
title: CLI
description: A interface de linha de comando do test-proxy-recorder — opções, ritmo de reprodução do WebSocket e como redefinir um proxy travado.
i18nSource: docs/guides/cli.md
i18nSourceBlob: 354b4fe6118719c0fdbfe91d37a9c3db2ab33bd7
---

```bash
test-proxy-recorder <target-url> [options]
```

| Opção            | Padrão         | Descrição                           |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(obrigatório)* | URL do backend a ser proxied       |
| `--port, -p`     | `8000`         | Porta de escuta do proxy           |
| `--dir, -d`      | `./recordings` | Diretório para os arquivos de gravação |
| `--timeout, -t`  | `120000`       | Timeout de redefinição automática da sessão (ms) |
| `--config, -c`   | *(automático)* | Caminho para um arquivo de config  |
| `--ws-timing`    | `burst`        | Ritmo de reprodução do WebSocket — `burst` ou `original` |

A remoção de segredos fica **ativa por padrão** — Authorization/Cookie/Set-Cookie são removidos das gravações automaticamente. Desative-a com `--no-redact` ou com `redaction: false` na [config](/pt-br/docs/guides/config/). Veja [remoção de segredos](/pt-br/docs/guides/secret-redaction/) para as flags `--redact-headers` e `--redact-body` que acrescentam ao que é removido.

```bash
# Exemplos
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## Ritmo de reprodução do WebSocket

Por padrão, as mensagens de servidor WebSocket gravadas são reproduzidas como um **burst** ao conectar — o mais rápido e totalmente determinístico, ideal para CI. Passe `--ws-timing original` (ou `websocket: { timing: 'original' }` na config) para, em vez disso, redosá-las usando os timestamps gravados, de modo que as mensagens cheguem com seus intervalos reais entre mensagens; um teste então leva aproximadamente o tempo real decorrido da gravação.

Você também pode definir isso **por teste** via `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, o que sobrescreve o padrão do nível do proxy apenas para essa sessão.

## Redefinir um proxy travado

O proxy reverte automaticamente para `transparent` depois que cada sessão expira, e o `globalTeardown` o redefine no final de uma execução limpa. Mas uma execução **interrompida** (`Ctrl+C`), uma sessão de UI/debug ou uma config sem `globalTeardown` pode deixar o proxy compartilhado travado em `record`/`replay` — então sua aplicação continua servindo respostas gravadas em vez de acessar o backend real. Redefina-o sob demanda:

```bash
test-proxy-recorder reset    # ou: npm run proxy:reset
```

Isso faz POST de `{ "mode": "transparent" }` para `/__control` — o substituto compatível com paralelismo e suportado para redefinir à mão com `curl`. É seguro executar a qualquer momento: um proxy inacessível é tratado como um no-op. A porta é resolvida como **flag `--port` → env `TEST_PROXY_RECORDER_PORT` → arquivo de config → `8000`**, então ela mira a porta na qual o proxy foi iniciado (passe `--port` / `--config` para sobrescrever). O `init` gera isso como o script `proxy:reset`.

## `init` — gerar a configuração

Veja o [início rápido](/pt-br/docs/getting-started/quick-start/) para a configuração recomendada com um único comando usando `npx test-proxy-recorder init`.
