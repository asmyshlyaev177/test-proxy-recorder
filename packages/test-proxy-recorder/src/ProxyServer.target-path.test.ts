import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from './constants.js';
import { ProxyServer } from './ProxyServer.js';

const RECORDINGS_DIR = path.join(process.cwd(), 'test-recordings-target-path');
const PROXY_PORT = 9893;
const BACKEND_PORT = 9894;
// A target with a path, as an API base URL usually has (OpenRouter is https://openrouter.ai/api/v1).
const TARGET = `http://localhost:${BACKEND_PORT}/api/v1`;

type Seen = { url: string; host: string | undefined; acceptEncoding?: string };

describe('record mode against a target with a path', () => {
  let backend: http.Server;
  let proxy: ProxyServer;
  let proxyHttp: http.Server;
  const seen: Seen[] = [];

  beforeEach(async () => {
    await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
    seen.length = 0;
    backend = http.createServer((req, res) => {
      seen.push({
        url: req.url!,
        host: req.headers.host,
        acceptEncoding: req.headers['accept-encoding'] as string | undefined,
      });
      if (req.url === '/api/v1/gzipped') {
        // Like a CDN that compresses whatever the client says.
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Transfer-Encoding': 'chunked',
        });
        res.end(zlib.gzipSync(JSON.stringify({ zipped: true })));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));
    proxy = new ProxyServer(TARGET, RECORDINGS_DIR);
    await proxy.init();
    proxyHttp = proxy.listen(PROXY_PORT);
    await new Promise<void>((resolve) => proxyHttp.on('listening', resolve));
  });

  afterEach(async () => {
    // fetch keeps the socket to the proxy alive, and close() waits on open sockets.
    proxyHttp.closeAllConnections();
    await new Promise<void>((resolve) => proxyHttp.close(() => resolve()));
    await new Promise<void>((resolve) => backend.close(() => resolve()));
    await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
  });

  it('prefixes the target path and names the target in Host, in transparent and record mode alike', async () => {
    const call = (id?: string) =>
      fetch(`http://localhost:${PROXY_PORT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(id ? { [RECORDING_ID_HEADER]: id } : {}),
        },
        body: '{"model":"x"}',
      });

    const transparent = await call();
    expect(transparent.status).toBe(200);
    expect(seen[0]).toMatchObject({
      url: '/api/v1/chat/completions',
      host: `localhost:${BACKEND_PORT}`,
    });

    await fetch(`http://localhost:${PROXY_PORT}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'record', id: 'target-path' }),
    });
    const recorded = await call('target-path');
    expect(recorded.status).toBe(200);
    expect(await recorded.json()).toEqual({ ok: true });
    expect(seen[1]).toEqual({
      url: '/api/v1/chat/completions',
      host: `localhost:${BACKEND_PORT}`,
      acceptEncoding: 'identity',
    });
  });

  it('stores a compressed upstream body as text and replays it readable', async () => {
    const control = (body: object) =>
      fetch(`http://localhost:${PROXY_PORT}/__control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    await control({ mode: 'record', id: 'zipped' });
    const recorded = await fetch(`http://localhost:${PROXY_PORT}/gzipped`, {
      headers: { [RECORDING_ID_HEADER]: 'zipped' },
    });
    expect(await recorded.json()).toEqual({ zipped: true });
    await control({ mode: 'transparent' });

    const file = JSON.parse(
      await fs.readFile(path.join(RECORDINGS_DIR, 'zipped.mock.json'), 'utf8'),
    ) as {
      recordings: {
        response: { body: string; headers: Record<string, string> };
      }[];
    };
    expect(file.recordings[0]?.response.body).toBe('{"zipped":true}');
    expect(
      file.recordings[0]?.response.headers['content-encoding'],
    ).toBeUndefined();
    expect(
      file.recordings[0]?.response.headers['transfer-encoding'],
    ).toBeUndefined();

    await control({ mode: 'replay', id: 'zipped' });
    const replayed = await fetch(`http://localhost:${PROXY_PORT}/gzipped`, {
      headers: { [RECORDING_ID_HEADER]: 'zipped' },
    });
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({ zipped: true });
  });
});
