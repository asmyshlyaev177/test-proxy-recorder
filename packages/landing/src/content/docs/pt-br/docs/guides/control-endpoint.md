---
title: Endpoint de controle
description: O proxy expõe o /__control para a troca programática de modo entre transparent, record e replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 3e99ff1996f606cf228da7e95d6080d77af00aec
---

O proxy expõe o `/__control` para a troca programática de modo.

```bash
# Obter o estado atual
curl http://localhost:8100/__control

# Trocar os modos
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1"}'
```

```typescript
interface ControlRequest {
  mode?: 'transparent' | 'record' | 'replay'; // obrigatório a menos que cleanup seja true
  id?: string;       // obrigatório para record/replay (e para cleanup)
  timeout?: number;  // timeout de redefinição automática em ms (padrão: 120000)
  cleanup?: boolean; // quando true, salva e fecha a sessão desse id em vez de trocar o modo
  websocket?: WebSocketReplayConfig; // sobrescrita de ritmo de reprodução de WebSocket por sessão
}
```

Na maioria das configurações você não chama isso diretamente — o `playwrightProxy.before()` e o `setProxyMode()` (veja a [referência da API](/docs/reference/api/readme/)) fazem POST nele para você. Use o `/__control` ao conduzir o proxy a partir de um shell, de uma etapa da CI ou de um agente de IA.

## Sessões

O proxy mantém uma sessão por id de teste, no modo record assim como no replay, então testes em workers paralelos compartilham um único proxy. Cada requisição vai para a sessão indicada no seu header `x-test-rcrd-id`, ou no cookie `proxy-recording-id` no handshake de um WebSocket do navegador. As versões até 2.0.1 mantinham uma única sessão de gravação para todas as requisições.

- **`{"mode": "record", "id": "my-test-1"}`** começa a gravar essa sessão. As sessões que já estão gravando continuam.
- **`{"id": "my-test-1", "cleanup": true}`** age só sobre essa sessão. Uma sessão de reprodução é fechada. Uma sessão de gravação é salva no seu `.mock.json` e continua gravando as requisições que a indicam até uma troca para `transparent`, então uma requisição tardia desse teste também é salva.
- **`{"mode": "transparent"}`** salva e encerra todas as sessões, então toda requisição passa direto para o destino. O `playwrightProxy.teardown()` envia isso. O timer de modo faz o mesmo quando o `timeout` se esgota, e toda troca reinicia o timer.

Uma requisição que não indica nenhuma sessão vai para a única sessão em andamento. Com várias sessões em andamento, o proxy responde a ela com um 400, tanto em record quanto em replay, e o corpo lista os ids em andamento em `activeSessions`. Sem nenhuma sessão em andamento, a requisição segue a última troca.

## Estado atual

`GET /__control` retorna:

- `recordingsDir`, o diretório em que as gravações são escritas.
- `mode` e `id`, da última troca.
- `redaction`, a config de [remoção](/pt-br/docs/guides/secret-redaction/) de segredos, ou `false` quando a remoção está desativada. O `playwrightProxy.teardown()` a lê para remover os segredos dos arquivos `.har`.
- `sessions`, os ids que estão gravando agora.
