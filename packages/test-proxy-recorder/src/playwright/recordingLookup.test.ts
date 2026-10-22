import { once } from 'node:events';
import { existsSync, promises as fs } from 'node:fs';
import http from 'node:http';
import type net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROXY_PORT_ENV, RECORDING_ID_HEADER } from '../constants.js';
import {
  generateSessionId,
  hasRecording,
  type PlaywrightTestInfo,
  ProxyServer,
  startRecording,
  startReplay,
  stopProxy,
} from '../index.js';
import {
  getHarPath,
  getRecordingPath,
  saveRecordingSession,
} from '../utils/fileUtils.js';
import { __resetProxyCachesForTests } from './index.js';

// A real proxy writes the recordings; hasRecording and replay, imported from the
// package root as a consumer would, must find them by the names the proxy chose.

const LONG_TITLE =
  "the run's questions are asked in its own chat beside it, the answer changes the resume, and the run is listed at home";
const longTest: PlaywrightTestInfo = {
  title: LONG_TITLE,
  titlePath: ['screening.spec.ts', 'tailoring', LONG_TITLE],
};
const shortTest: PlaywrightTestInfo = {
  title: 'renders',
  titlePath: ['todos.spec.ts', 'renders'],
};

let recordingsDir: string;
let backend: http.Server;
let proxy: http.Server;
let backendHits = 0;

// The event, not server.listening: that is true before the proxy's own listen
// callback runs, which then sets PROXY_PORT_ENV to the 0 it was given.
async function listening(server: http.Server): Promise<number> {
  await once(server, 'listening');
  return (server.address() as net.AddressInfo).port;
}

async function close(server: http.Server): Promise<void> {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

function getTodos(testInfo: PlaywrightTestInfo): Promise<Response> {
  return fetch(`http://localhost:${process.env[PROXY_PORT_ENV]}/todos`, {
    headers: { [RECORDING_ID_HEADER]: generateSessionId(testInfo) },
  });
}

async function record(testInfo: PlaywrightTestInfo): Promise<void> {
  await startRecording(testInfo);
  const response = await getTodos(testInfo);
  await response.text();
  await stopProxy(testInfo);
}

async function getProxyMode(): Promise<string> {
  const response = await fetch(
    `http://localhost:${process.env[PROXY_PORT_ENV]}/__control`,
  );
  return ((await response.json()) as { mode: string }).mode;
}

beforeEach(async () => {
  recordingsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tpr-has-recording-'),
  );
  backendHits = 0;
  backend = http.createServer((_req, res) => {
    backendHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
  });
  const backendPort = listening(backend.listen(0));
  const server = new ProxyServer(
    `http://localhost:${await backendPort}`,
    recordingsDir,
  );
  await server.init();
  proxy = server.listen(0);
  process.env[PROXY_PORT_ENV] = String(await listening(proxy));
  __resetProxyCachesForTests();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await close(proxy);
  await close(backend);
  delete process.env[PROXY_PORT_ENV];
  await fs.rm(recordingsDir, { recursive: true, force: true });
});

describe('hasRecording', () => {
  it('finds a recording the proxy saved under a cut, hashed name', async () => {
    const id = generateSessionId(longTest);
    expect(Buffer.byteLength(id)).toBeGreaterThan(120);

    await record(longTest);

    // The check consumers wrote by hand, which skipped this test silently.
    expect(existsSync(path.join(recordingsDir, `${id}.mock.json`))).toBe(false);
    expect(path.basename(getRecordingPath(recordingsDir, id))).toMatch(
      /_[0-9a-f]{8}\.mock\.json$/,
    );
    expect(await hasRecording(longTest)).toBe(true);
    expect(await hasRecording(longTest, { recordingsDir })).toBe(true);
  });

  it('is false for a test that has not been recorded', async () => {
    await record(shortTest);

    expect(await hasRecording(longTest)).toBe(false);
    expect(await hasRecording(longTest, { recordingsDir })).toBe(false);
  });

  it('finds a recording saved under the file name of earlier versions', async () => {
    const id = generateSessionId(longTest);
    await record(longTest);
    await fs.rename(
      getRecordingPath(recordingsDir, id),
      path.join(recordingsDir, `${id}.mock.json`),
    );

    expect(await hasRecording(longTest)).toBe(true);
  });

  it('finds a recording saved under the id from before describe titles counted', async () => {
    const slug = LONG_TITLE.replaceAll(' ', '-');
    await fs.writeFile(
      getRecordingPath(recordingsDir, `screening__${slug}`),
      '{}',
    );

    expect(await hasRecording(longTest)).toBe(true);
  });

  it('counts a browser-side HAR as a recording', async () => {
    await fs.writeFile(
      getHarPath(recordingsDir, generateSessionId(longTest)),
      '{}',
    );

    expect(await hasRecording(longTest)).toBe(true);
  });

  it('finds whatever the proxy saves for any test title', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const testInfo = fc.record({
      file: fc.constantFrom('a.spec.ts', 'jobs/b.test.ts', 'c.e2e.ts'),
      titles: fc.array(fc.string({ unit: 'binary', maxLength: 150 }), {
        minLength: 1,
        maxLength: 3,
      }),
    });

    await fc.assert(
      fc.asyncProperty(testInfo, async ({ file, titles }) => {
        const info = { title: titles.at(-1)!, titlePath: [file, ...titles] };
        await saveRecordingSession(recordingsDir, {
          id: generateSessionId(info),
          recordings: [],
          websocketRecordings: [],
        });

        expect(await hasRecording(info, { recordingsDir })).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

describe('replay', () => {
  it('throws for a test with no recording, naming the file it looked for', async () => {
    const expected = getRecordingPath(
      recordingsDir,
      generateSessionId(longTest),
    );

    await expect(startReplay(longTest)).rejects.toThrow(
      `This test has no recording: ${expected} does not exist`,
    );
    expect(await getProxyMode()).toBe('transparent');
  });

  it('replays a test whose recording has a cut, hashed name', async () => {
    await record(longTest);
    const hitsBeforeReplay = backendHits;

    await startReplay(longTest);
    const replayed = await getTodos(longTest);

    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual([]);
    expect(backendHits).toBe(hitsBeforeReplay);
  });
});
