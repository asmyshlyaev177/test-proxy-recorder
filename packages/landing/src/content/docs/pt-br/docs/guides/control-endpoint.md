---
title: Endpoint de controle
description: O proxy expõe o /__control para a troca programática de modo entre transparent, record e replay.
i18nSource: docs/guides/control-endpoint.md
i18nSourceBlob: 17fac3de2790301f1ba96f8b4db21a5f01c05d79
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
  cleanup?: boolean; // quando true, limpa a sessão em vez de trocar o modo
  websocket?: WebSocketReplayConfig; // sobrescrita de ritmo de reprodução de WebSocket por sessão
}
```

Na maioria das configurações você não chama isso diretamente — o `playwrightProxy.before()` e o `setProxyMode()` (veja a [referência da API](/docs/reference/api/readme/)) fazem POST nele para você. Use o `/__control` ao conduzir o proxy a partir de um shell, de uma etapa da CI ou de um agente de IA.
