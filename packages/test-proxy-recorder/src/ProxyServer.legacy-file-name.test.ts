import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from './constants.js';
import { ProxyServer } from './ProxyServer.js';
import { getRecordingPath } from './utils/fileUtils.js';

// Recordings saved by earlier versions used other file names; replay still reads them
// when no file exists under the current name.

const BACKEND_PORT = 8351;
const PROXY_PORT = 8352;
const proxyUrl = `http://localhost:${PROXY_PORT}`;
// 130 characters: kept whole by the old names, capped with a hash by the new.
const SESSION = 'a'.repeat(130);

let tempDir: string;
let backend: http.Server;
let proxy: http.Server;
let backendHits = 0;

async function setMode(mode: string, id?: string): Promise<void> {
  const res = await fetch(`${proxyUrl}/__control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, id }),
  });
  expect(res.status).toBe(200);
}

function getInSession(urlPath: string) {
  return fetch(`${proxyUrl}${urlPath}`, {
    headers: { [RECORDING_ID_HEADER]: SESSION },
    signal: AbortSignal.timeout(2000),
  });
}

beforeEach(async () => {
  backendHits = 0;
  tempDir = await fs.mkdtemp(
    path.join(process.cwd(), 'test-recordings-legacy-'),
  );
  backend = http.createServer((_req, res) => {
    backendHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"from":"backend"}');
  });
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));

  const server = new ProxyServer(`http://localhost:${BACKEND_PORT}`, tempDir);
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

describe('ProxyServer - recordings saved under an old file name', () => {
  it('replays a session whose file has the earlier name', async () => {
    await setMode('record', SESSION);
    const recorded = await getInSession('/todos');
    await recorded.text();
    await setMode('transparent');
    await fs.rename(
      getRecordingPath(tempDir, SESSION),
      path.join(tempDir, `${SESSION}.mock.json`),
    );
    const hitsBeforeReplay = backendHits;

    await setMode('replay', SESSION);
    const replayed = await getInSession('/todos');

    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({ from: 'backend' });
    expect(backendHits).toBe(hitsBeforeReplay);
  });
});
