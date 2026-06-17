---
title: CLI
description: La interfaz de línea de comandos de test-proxy-recorder — opciones, ritmo de reproducción de WebSocket y cómo reiniciar un proxy atascado.
---

```bash
test-proxy-recorder <target-url> [options]
```

| Opción           | Por defecto    | Descripción                         |
| ---------------- | -------------- | ----------------------------------- |
| `<target-url>`   | *(requerido)*  | URL del backend a proxiar           |
| `--port, -p`     | `8000`         | Puerto de escucha del proxy         |
| `--dir, -d`      | `./recordings` | Directorio para los archivos de grabación |
| `--timeout, -t`  | `120000`       | Timeout de auto-reinicio de sesión (ms) |
| `--config, -c`   | *(auto)*       | Ruta a un archivo de configuración  |
| `--ws-timing`    | `burst`        | Ritmo de reproducción de WebSocket — `burst` u `original` |

La redacción de secretos está **activada por defecto** — Authorization/Cookie/Set-Cookie se eliminan de las grabaciones automáticamente. Desactívala con `--no-redact`, o `redaction: false` en la [configuración](/es/docs/guides/config/). Mira [redacción de secretos](/es/docs/guides/secret-redaction/) para los flags `--redact-headers` y `--redact-body` que añaden a lo que se redacta.

```bash
# Examples
test-proxy-recorder http://localhost:8000
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks
```

## Ritmo de reproducción de WebSocket

Por defecto, los mensajes de servidor de WebSocket grabados se reproducen en **ráfaga** (`burst`) al conectar — lo más rápido y totalmente determinista, ideal para CI. Pasa `--ws-timing original` (o `websocket: { timing: 'original' }` en la configuración) para reproducirlos usando las marcas de tiempo grabadas, de modo que los mensajes lleguen con sus intervalos reales; una prueba entonces dura aproximadamente el tiempo de reloj de la grabación.

También puedes establecer esto **por prueba** vía `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`, que anula el valor por defecto del proxy solo para esa sesión.

## Reiniciar un proxy atascado

El proxy vuelve automáticamente a `transparent` tras el timeout de cada sesión, y el `globalTeardown` lo reinicia al final de una ejecución limpia. Pero una ejecución **interrumpida** (`Ctrl+C`), una sesión de UI/depuración, o una configuración sin `globalTeardown` pueden dejar el proxy compartido atascado en `record`/`replay` — de modo que tu app sigue sirviendo respuestas grabadas en vez de llamar al backend real. Reinícialo bajo demanda:

```bash
test-proxy-recorder reset    # or: npm run proxy:reset
```

Esto hace POST de `{ "mode": "transparent" }` a `/__control` — el reemplazo soportado y seguro en paralelo para reiniciar a mano con `curl`. Es seguro ejecutarlo en cualquier momento: un proxy inalcanzable se trata como un no-op. El puerto se resuelve como **flag `--port` → env `TEST_PROXY_RECORDER_PORT` → archivo de configuración → `8000`**, así que apunta al puerto en el que se inició el proxy (pasa `--port` / `--config` para anular). `init` lo genera como el script `proxy:reset`.

## `init` — generar la configuración

Mira el [inicio rápido](/es/docs/getting-started/quick-start/) para la configuración recomendada de un solo comando con `npx test-proxy-recorder init`.
