import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { getFreePort, makeTempDir, type Proxy, RECORDING_ID_HEADER, startProxy } from './cli-proxy';
import { MOCK_BACKEND_URL } from './ports';

// Layer 2 (see e2e/README.md): several Playwright workers recording through one proxy and one
// backend, driven the way the helper drives it. Each worker runs its tests back to back: a session
// switch, calls under that session, then the cleanup Playwright sends from `context.on('close')`
// without awaiting it, so it overlaps the next test's switch and the other workers' calls. Every
// call must be answered promptly and land in its own session's file. On 2.0.1 the proxy held one
// record session for all requests: calls crossed into other sessions, and a cleanup landing after
// the next switch left record mode with no session, so every later call hung (2026-10-27).

const WORKERS = 4;
const TESTS_PER_WORKER = 3;
const CALLS_PER_TEST = 2;

const control = (proxy: Proxy, body: Record<string, unknown>) =>
  fetch(proxy.control, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json() as Promise<{ success?: boolean }>);

// `timeoutMs` is the client's patience, as the app's is; a hung call fails here, not minutes later.
const slowCall = (proxy: Proxy, sessionId: string, tag: string, ms: number) =>
  fetch(`http://127.0.0.1:${proxy.port}/slow?ms=${ms}&tag=${tag}`, {
    headers: { [RECORDING_ID_HEADER]: sessionId },
    signal: AbortSignal.timeout(5_000),
  }).then((res) => res.json() as Promise<{ ok: boolean; ms: number }>);

const recordedUrls = async (proxy: Proxy, sessionId: string) => {
  const saved = JSON.parse(await fs.readFile(proxy.recordingPath(sessionId), 'utf8')) as {
    recordings: { request: { url: string } }[];
  };
  return saved.recordings.map((r) => r.request.url);
};

const sessionId = (worker: number, index: number) => `parallel-w${worker}-t${index}`;
const callUrl = (worker: number, index: number, call: number) => `/slow?ms=${100 + call * 150 + worker * 20}&tag=w${worker}t${index}c${call}`;

async function runWorker(proxy: Proxy, worker: number) {
  let pendingCleanup: Promise<unknown> = Promise.resolve();
  for (let index = 0; index < TESTS_PER_WORKER; index++) {
    const id = sessionId(worker, index);
    await control(proxy, { mode: 'record', id });
    const calls = Array.from({ length: CALLS_PER_TEST }, (_, call) => slowCall(proxy, id, `w${worker}t${index}c${call}`, 100 + call * 150 + worker * 20));
    // The last call is left in flight at the test's end, as a page's background request would be.
    await calls[0];
    pendingCleanup = Promise.all([...calls, control(proxy, { id, cleanup: true })]);
  }
  await pendingCleanup;
}

test('several workers record through one proxy, each call into its own session', async () => {
  const dir = await makeTempDir();
  const recordingsDir = path.join(dir, 'recordings');
  let proxy: Proxy | undefined;

  try {
    proxy = await startProxy(dir, { args: [MOCK_BACKEND_URL, '--dir', recordingsDir], port: await getFreePort(), recordingsDir });
    const running = proxy;
    await Promise.all(Array.from({ length: WORKERS }, (_, worker) => runWorker(running, worker)));
    await control(proxy, { mode: 'transparent' });

    for (let worker = 0; worker < WORKERS; worker++) {
      for (let index = 0; index < TESTS_PER_WORKER; index++) {
        // The file keeps the proxy's arrival order, which two calls sent in one tick do not fix.
        const expected = Array.from({ length: CALLS_PER_TEST }, (_, call) => callUrl(worker, index, call)).toSorted();
        const recorded = await recordedUrls(proxy, sessionId(worker, index));
        expect(recorded.toSorted(), sessionId(worker, index)).toEqual(expected);
      }
    }
  } finally {
    await proxy?.stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
