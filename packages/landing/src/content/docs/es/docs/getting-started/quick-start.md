---
title: Inicio rápido
description: Un solo comando init integra test-proxy-recorder — middleware SSR de Next.js incluido. Apunta tu API al proxy, graba una vez, reproduce en CI.
---

## 1. Generar el andamiaje

```bash
npm install --save-dev test-proxy-recorder
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```

Esto escribe todo y no sobrescribe nada:

```text
test-proxy-recorder.config.ts
playwright.config.ts
proxy.ts                 # Solo Next.js — middleware SSR
e2e/fixtures.ts          # grabar vs reproducir
e2e/global-teardown.ts
package.json             # + scripts proxy / test:e2e
```

## 2. Apunta la API de tu app al proxy

Lo único que `init` no puede adivinar: qué variable de entorno guarda la URL base de tu API. Apúntala al proxy cuando el grabador está activo, y al backend real en caso contrario — el proxy nunca se ejecuta en producción:

```ts
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // dirección del proxy según `init`
```

## 3. Graba una vez, reproduce para siempre

```bash
# fixtures.ts: MODE = 'record' — captura respuestas reales
npm run test:e2e:record

# fixtures.ts: MODE = 'replay' — luego haz commit de las grabaciones
git add e2e/recordings/ && git commit -m "add e2e recordings"
```

Ahora CI reproduce con el backend apagado — mismas respuestas cada vez.

---

¿Lo integras a mano, o quieres los detalles? Consulta la [configuración manual](/es/docs/getting-started/manual-setup/) y [cómo funciona](/es/docs/getting-started/how-it-works/).
