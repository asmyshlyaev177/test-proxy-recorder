import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MISSING_RECORDING_ENDPOINT,
  RECORDING_ID_HEADER,
} from './constants.js';
import { ProxyServer } from './ProxyServer.js';

// A test in replay holds a long-poll open; the proxy answers it the moment a
// request in that session has no recording, so the test can fail at once.

const BACKEND_PORT = 8331;
const PROXY_PORT = 8332;
const proxyUrl = `http://localhost:${PROXY_PORT}`;

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

function getInSession(urlPath: string, sessionId: string) {
  return fetch(`${proxyUrl}${urlPath}`, {
    headers: { [RECORDING_ID_HEADER]: sessionId },
  });
}

function pollMissing(sessionId: string, signal?: AbortSignal) {
  return fetch(
    `${proxyUrl}${MISSING_RECORDING_ENDPOINT}?id=${encodeURIComponent(sessionId)}`,
    { signal },
  );
}

/** Settles with 'pending' when the promise has not settled within `ms`. */
function settledWithin<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<'pending'>((resolve) =>
      setTimeout(() => resolve('pending'), ms),
    ),
  ]);
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(
    path.join(process.cwd(), 'test-recordings-missing-'),
  );
  backend = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));

  const server = new ProxyServer(`http://localhost:${BACKEND_PORT}`, tempDir);
  await server.init();
  proxy = server.listen(PROXY_PORT);
  await new Promise<void>((resolve) => proxy.once('listening', resolve));

  // One recorded request, GET /recorded, in session 'with-recording'.
  await setMode('record', 'with-recording');
  await getInSession('/recorded', 'with-recording');
  await setMode('transparent');
});

afterEach(async () => {
  proxy.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => backend.close(resolve));
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('ProxyServer - missing recordings in replay', () => {
  it('answers a waiting poll when a request has no recording', async () => {
    await setMode('replay', 'with-recording');
    const poll = pollMissing('with-recording');

    const recorded = await getInSession('/recorded', 'with-recording');
    expect(recorded.status).toBe(200);
    expect(await settledWithin(poll, 200)).toBe('pending');

    const unrecorded = await getInSession('/unrecorded', 'with-recording');
    expect(unrecorded.status).toBe(404);
    const report = await poll;
    expect(report.status).toBe(200);
    const { message } = (await report.json()) as { message: string };
    expect(message).toContain('GET /unrecorded');
    expect(message).toContain('with-recording');
  });

  it('answers a poll that arrives after the unrecorded request', async () => {
    await setMode('replay', 'with-recording');
    await getInSession('/unrecorded', 'with-recording');

    const report = await settledWithin(pollMissing('with-recording'), 1000);

    expect(report).not.toBe('pending');
    expect((report as Response).status).toBe(200);
  });

  it('reports a session with no recording file at all', async () => {
    await setMode('replay', 'never-recorded');
    const poll = pollMissing('never-recorded');

    await getInSession('/anything', 'never-recorded');

    const report = await poll;
    expect(report.status).toBe(200);
    const { message } = (await report.json()) as { message: string };
    expect(message).toContain('never-recorded');
  });

  it('does not report to other sessions', async () => {
    await setMode('replay', 'with-recording');
    const otherPoll = pollMissing('other-session');

    await getInSession('/unrecorded', 'with-recording');

    expect(await settledWithin(otherPoll, 200)).toBe('pending');
  });

  it('forgets the report when the session enters replay again (a retry)', async () => {
    await setMode('replay', 'with-recording');
    await getInSession('/unrecorded', 'with-recording');

    await setMode('replay', 'with-recording');
    const controller = new AbortController();
    const poll = pollMissing('with-recording', controller.signal);

    expect(await settledWithin(poll, 200)).toBe('pending');
    controller.abort();
    await poll.catch(() => {});
  });
});
