import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from './constants.js';
import { ProxyServer } from './ProxyServer.js';

// Body redaction changes the stored body but not the recorded content-length,
// so replay must not send the recorded value: a client then waits for bytes
// that never come.

const BACKEND_PORT = 8341;
const PROXY_PORT = 8342;
const proxyUrl = `http://localhost:${PROXY_PORT}`;
const SESSION = 'redacted-body';
const BACKEND_BODY = '{"token":"sk_live_abcdefghijklmnopqrstuvwxyz"}';

let tempDir: string;
let backend: http.Server;
let proxy: http.Server;

async function setMode(mode: string, id?: string): Promise<void> {
  const res = await fetch(`${proxyUrl}/__control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, id }),
  });
  expect(res.status).toBe(200);
}

function getInSession(urlPath: string, method = 'GET') {
  return fetch(`${proxyUrl}${urlPath}`, {
    method,
    headers: { [RECORDING_ID_HEADER]: SESSION },
    signal: AbortSignal.timeout(2000),
  });
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(
    path.join(process.cwd(), 'test-recordings-redacted-'),
  );
  backend = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(BACKEND_BODY),
    });
    res.end(req.method === 'HEAD' ? undefined : BACKEND_BODY);
  });
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));

  const server = new ProxyServer(
    `http://localhost:${BACKEND_PORT}`,
    tempDir,
    undefined,
    { bodyPatterns: [/sk_live_\w+/g] },
  );
  await server.init();
  proxy = server.listen(PROXY_PORT);
  await new Promise<void>((resolve) => proxy.once('listening', resolve));
});

afterEach(async () => {
  proxy.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => backend.close(resolve));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('ProxyServer - replaying a redacted body', () => {
  it('sends the content-length of the body it replays', async () => {
    await setMode('record', SESSION);
    const recorded = await getInSession('/token');
    await recorded.text();
    await setMode('replay', SESSION);

    const replayed = await getInSession('/token');
    const body = await replayed.text();

    expect(body).not.toContain('sk_live_');
    expect(replayed.headers.get('content-length')).toBe(
      String(Buffer.byteLength(body)),
    );
  });

  it('keeps the recorded content-length of a HEAD response, which has no body', async () => {
    await setMode('record', SESSION);
    await getInSession('/token', 'HEAD');
    await setMode('replay', SESSION);

    const replayed = await getInSession('/token', 'HEAD');

    expect(replayed.headers.get('content-length')).toBe(
      String(Buffer.byteLength(BACKEND_BODY)),
    );
  });
});
