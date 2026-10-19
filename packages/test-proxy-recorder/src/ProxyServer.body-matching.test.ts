import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MISSING_RECORDING_ENDPOINT,
  RECORDING_ID_HEADER,
} from './constants.js';
import { ProxyServer } from './ProxyServer.js';
import { getRecordingPath } from './utils/fileUtils.js';

// Requests with one method, path and query share a recording key. Replay must
// tell them apart by body, or a request that arrives in a different order than
// it was recorded in (parallel calls do) gets a sibling's response. A body no
// recording has fails rather than take another request's recording.

const BACKEND_PORT = 8361;
const PROXY_PORT = 8362;
const proxyUrl = `http://localhost:${PROXY_PORT}`;
const SESSION = 'body-matching';

interface Echo {
  call: number;
  body: string;
}

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

function send(
  body: string | FormData,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${proxyUrl}/embeddings`, {
    method: 'POST',
    headers: {
      [RECORDING_ID_HEADER]: SESSION,
      ...(typeof body === 'string' && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body,
    signal: AbortSignal.timeout(5000),
  });
}

async function post(
  body: string | FormData,
  headers?: Record<string, string>,
): Promise<Echo> {
  const res = await send(body, headers);
  expect(res.status).toBe(200);
  return (await res.json()) as Echo;
}

/** The reason the proxy gave the test for its first request with no recording. */
async function getMissingReport(): Promise<string> {
  const res = await fetch(
    `${proxyUrl}${MISSING_RECORDING_ENDPOINT}?id=${SESSION}`,
    { signal: AbortSignal.timeout(2000) },
  );
  return ((await res.json()) as { message: string }).message;
}

function multipart(boundary: string, value: string): string {
  return `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\n\r\n${value}\r\n--${boundary}--\r\n`;
}

function batch(...input: string[]): string {
  return JSON.stringify({ input });
}

function inputOf(echo: Echo): string[] {
  return (JSON.parse(echo.body) as { input: string[] }).input;
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-recordings-body-'));
  // Each response names the body it answered and how many calls came before it,
  // so a replay shows both which recording it served and whose request that was.
  let call = 0;
  backend = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      call += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ call, body: Buffer.concat(chunks).toString('utf8') }),
      );
    });
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

describe('ProxyServer - replay matches same-key requests by body', () => {
  const batches = [
    batch('a1'),
    batch('b1', 'b2'),
    batch('c1', 'c2', 'c3'),
    batch('d1', 'd2', 'd3', 'd4'),
  ];

  it('answers each request with the recording of its own body when they come in reverse order', async () => {
    await setMode('record', SESSION);
    for (const body of batches) await post(body);
    await setMode('replay', SESSION);

    const replayed: Echo[] = [];
    for (const body of batches.toReversed()) replayed.push(await post(body));

    expect(replayed.map((echo) => echo.body)).toEqual(batches.toReversed());
  });

  it('answers parallel requests with different bodies with their own responses', async () => {
    await setMode('record', SESSION);
    await Promise.all(batches.map((body) => post(body)));
    await setMode('replay', SESSION);

    const replayed = await Promise.all(
      batches.toReversed().map((body) => post(body)),
    );

    expect(replayed.map((echo) => echo.body)).toEqual(batches.toReversed());
  });

  it('fails a request whose body no recording has and names the cause', async () => {
    await setMode('record', SESSION);
    await post(JSON.stringify({ at: 1 }));
    await setMode('replay', SESSION);

    const res = await send(JSON.stringify({ at: 2 }));

    expect(res.status).toBe(404);
    expect(await getMissingReport()).toBe(
      `No recording for POST /embeddings with this request body in session ${SESSION} (1 recorded with other bodies)`,
    );
  });

  it('keeps a recording for its own request when an unknown body comes first', async () => {
    await setMode('record', SESSION);
    await post(batch('known'));
    await post(JSON.stringify({ at: 1 }));
    await setMode('replay', SESSION);

    const unknown = await send(JSON.stringify({ at: 2 }));
    const known = await post(batch('known'));

    expect(unknown.status).toBe(404);
    expect(known.call).toBe(1);
  });

  it('keeps matching GET requests by recorded order alone', async () => {
    await setMode('record', SESSION);
    for (let i = 0; i < 2; i++) {
      await fetch(`${proxyUrl}/embeddings`, {
        headers: { [RECORDING_ID_HEADER]: SESSION },
      });
    }
    await setMode('replay', SESSION);

    const calls: number[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${proxyUrl}/embeddings`, {
        headers: { [RECORDING_ID_HEADER]: SESSION },
      });
      calls.push(((await res.json()) as Echo).call);
    }

    expect(calls).toEqual([1, 2]);
  });

  it('serves repeats of one body in recorded order, then reuses the last of them', async () => {
    await setMode('record', SESSION);
    await post(batch('same'));
    await post(batch('other'));
    await post(batch('same'));
    await setMode('replay', SESSION);

    const calls: number[] = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const echo = await post(batch('same'));
      calls.push(echo.call);
    }

    expect(calls).toEqual([1, 3, 3]);
  });

  it('matches a body whose secret the recording redacted', async () => {
    const withKey = (query: string) =>
      JSON.stringify({ apiKey: 'sk_live_abc123', input: [query] });
    await setMode('record', SESSION);
    await post(withKey('one'));
    await post(withKey('two'));
    await setMode('replay', SESSION);

    const two = await post(withKey('two'));
    const one = await post(withKey('one'));

    expect([inputOf(two), inputOf(one)]).toEqual([['two'], ['one']]);
  });

  it('matches multipart bodies though each request has its own boundary', async () => {
    const form = (value: string) => {
      const data = new FormData();
      data.append('file', new Blob([value]), `${value}.txt`);
      return data;
    };
    await setMode('record', SESSION);
    await post(form('first-file'));
    await post(form('second-file'));
    await setMode('replay', SESSION);

    const second = await post(form('second-file'));
    const first = await post(form('first-file'));

    expect(second.body).toContain('second-file');
    expect(first.body).toContain('first-file');
  });

  // Over 64 KiB a body arrives in several chunks, and a three-byte character
  // split between two of them must still decode to the text that was recorded.
  it('matches large bodies of multibyte text', async () => {
    const long = '€'.repeat(100_000);
    const bodies = [batch(long, 'end-a'), batch(long, 'end-b')];
    await setMode('record', SESSION);
    for (const body of bodies) await post(body);
    await setMode('replay', SESSION);

    const b = await post(bodies[1]);
    const a = await post(bodies[0]);

    expect([inputOf(b)[1], inputOf(a)[1]]).toEqual(['end-b', 'end-a']);
  });

  it('matches a quoted multipart boundary', async () => {
    const formType = (boundary: string) => ({
      'Content-Type': `multipart/form-data; boundary="${boundary}"; charset=utf-8`,
    });
    await setMode('record', SESSION);
    await post(multipart('rec-1', 'first'), formType('rec-1'));
    await post(multipart('rec-2', 'second'), formType('rec-2'));
    await setMode('replay', SESSION);

    const second = await post(
      multipart('live-2', 'second'),
      formType('live-2'),
    );
    const first = await post(multipart('live-1', 'first'), formType('live-1'));

    expect([second.call, first.call]).toEqual([2, 1]);
  });

  it('replays a hand-written recording that has no request headers', async () => {
    const recording = {
      id: SESSION,
      websocketRecordings: [],
      recordings: [
        {
          request: { method: 'POST', url: '/embeddings', body: batch('x') },
          response: { statusCode: 200, headers: {}, body: '{"call":7}' },
          timestamp: new Date().toISOString(),
          key: 'POST_embeddings.json',
          recordingId: 0,
        },
      ],
    };
    await fs.writeFile(
      getRecordingPath(tempDir, SESSION),
      JSON.stringify(recording),
    );
    await setMode('replay', SESSION);

    const echo = await post(batch('x'));
    expect(echo.call).toBe(7);
  });

  it('does not report a request whose client went away mid-body as missing', async () => {
    await setMode('record', SESSION);
    await post(batch('a'));
    await setMode('replay', SESSION);

    const socket = net.connect(PROXY_PORT, 'localhost');
    await new Promise((resolve) => socket.once('connect', resolve));
    socket.write(
      `POST /embeddings HTTP/1.1\r\nHost: localhost\r\n${RECORDING_ID_HEADER}: ${SESSION}\r\nContent-Length: 100\r\n\r\n{"in`,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    socket.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fetch(`${proxyUrl}/unrecorded`, {
      headers: { [RECORDING_ID_HEADER]: SESSION },
    });

    expect(await getMissingReport()).toContain('/unrecorded');
  });
});
