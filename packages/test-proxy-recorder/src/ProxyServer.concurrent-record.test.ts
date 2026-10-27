import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from './constants.js';
import { ProxyServer } from './ProxyServer.js';
import { loadRecordingSession } from './utils/fileUtils.js';
import { getReqIDFromUrl } from './utils/getReqID.js';

// Several Playwright workers record through one proxy: each call is filed under the session in its
// header, and one session's boundary (cleanup, switch, flush) never touches another's calls.

const RECORDINGS_DIR = path.join(
  process.cwd(),
  'test-recordings-concurrent-record',
);
const PROXY_PORT = 9890;
const BACKEND_PORT = 9891;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const PROXY_URL = `http://localhost:${PROXY_PORT}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const control = (body: Record<string, unknown>) =>
  fetch(`${PROXY_URL}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json() as Promise<Record<string, unknown>>);

const callUrl = (tag: string, ms = 0) => `/slow?ms=${ms}&tag=${tag}`;

// A call under one session, answered by the backend after `ms`; the path carries a tag so each file is checked by its urls.
const call = (
  sessionId: string | null,
  tag: string,
  ms = 0,
  timeoutMs = 5000,
) =>
  fetch(`${PROXY_URL}${callUrl(tag, ms)}`, {
    headers: sessionId ? { [RECORDING_ID_HEADER]: sessionId } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });

const recordedUrls = async (sessionId: string) => {
  const saved = await loadRecordingSession(
    path.join(RECORDINGS_DIR, `${sessionId}.mock.json`),
  );
  return saved.recordings.map((r) => r.request.url);
};

const writeReplayFixture = async (id: string, tag: string) => {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(RECORDINGS_DIR, `${id}.mock.json`),
    JSON.stringify({
      id,
      recordings: [
        {
          recordingId: 0,
          key: getReqIDFromUrl(`${PROXY_URL}${callUrl(tag)}`, 'GET'),
          sequence: 0,
          timestamp: new Date().toISOString(),
          request: {
            method: 'GET',
            url: callUrl(tag),
            headers: {},
            body: null,
          },
          response: {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tag }),
          },
        },
      ],
      websocketRecordings: [],
    }),
  );
};

describe('record sessions keyed per request', () => {
  let proxy: ProxyServer;
  let proxyHttp: http.Server;
  let backend: http.Server;
  let backendHits: string[];

  // Resolves once the backend has seen the call, so a boundary sent afterwards is sent with the call in flight.
  const reachedBackend = async (tag: string, ms = 0) => {
    while (!backendHits.includes(callUrl(tag, ms))) await sleep(5);
  };

  beforeEach(async () => {
    await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
    backendHits = [];
    backend = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', BACKEND_URL);
      backendHits.push(req.url ?? '/');
      setTimeout(
        () => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ tag: url.searchParams.get('tag') }));
        },
        Number(url.searchParams.get('ms') ?? 0),
      );
    });
    await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));
    proxy = new ProxyServer(BACKEND_URL, RECORDINGS_DIR);
    await proxy.init();
    proxyHttp = proxy.listen(PROXY_PORT);
    await new Promise<void>((resolve) => proxyHttp.on('listening', resolve));
  });

  afterEach(async () => {
    await control({ mode: 'transparent' });
    await new Promise<void>((resolve) => proxyHttp.close(() => resolve()));
    await new Promise<void>((resolve) => backend.close(() => resolve()));
    await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
  });

  it("files each session's calls into its own recording while three sessions record at once", async () => {
    const sessions = ['s1', 's2', 's3'];
    for (const id of sessions) await control({ mode: 'record', id });

    // Delays scramble the completion order across sessions; each session's two calls go out one after the other.
    const firsts = sessions.map((id, i) => call(id, `${id}-a`, 150 - i * 40));
    for (const [i, id] of sessions.entries())
      await reachedBackend(`${id}-a`, 150 - i * 40);
    const seconds = sessions.map((id, i) => call(id, `${id}-b`, 20 + i * 30));
    const answered = await Promise.all([...firsts, ...seconds]);
    expect(answered.map((res) => res.status)).toEqual(
      Array.from({ length: 6 }).fill(200),
    );

    const state = (await fetch(`${PROXY_URL}/__control`).then((res) =>
      res.json(),
    )) as { sessions: string[] };
    expect(state.sessions.toSorted()).toEqual(sessions);

    for (const id of sessions) await control({ id, cleanup: true });
    for (const [i, id] of sessions.entries()) {
      expect(await recordedUrls(id), id).toEqual([
        callUrl(`${id}-a`, 150 - i * 40),
        callUrl(`${id}-b`, 20 + i * 30),
      ]);
    }
  });

  it("answers and records the next session while the previous one's un-awaited cleanup is still flushing", async () => {
    await control({ mode: 'record', id: 'ending' });
    // Outlives the probe's patience: the probe passes only if the cleanup's flush blocks neither the switch nor the call.
    const inFlight = call('ending', 'late', 1500, 20_000);
    await reachedBackend('late', 1500);

    const cleanup = control({ id: 'ending', cleanup: true });
    await control({ mode: 'record', id: 'next' });
    const probe = await call('next', 'probe', 0, 1000);
    expect(probe.status).toBe(200);

    await Promise.all([cleanup, inFlight]);
    await control({ mode: 'transparent' });
    expect(await recordedUrls('ending')).toEqual([callUrl('late', 1500)]);
    expect(await recordedUrls('next')).toEqual([callUrl('probe')]);
  });

  it('keeps a call that arrives while the session is being flushed', async () => {
    await control({ mode: 'record', id: 'flushing' });
    const first = call('flushing', 'first', 300);
    await reachedBackend('first', 300);
    const cleanup = control({ id: 'flushing', cleanup: true });
    await sleep(50);
    const second = call('flushing', 'second', 50);
    await Promise.all([first, second, cleanup]);

    await control({ mode: 'transparent' });
    expect(await recordedUrls('flushing')).toEqual([
      callUrl('first', 300),
      callUrl('second', 50),
    ]);
  });

  it('replays one session while another records, through the same proxy', async () => {
    await writeReplayFixture('replayed', 'canned');
    await control({ mode: 'record', id: 'recording' });
    await control({ mode: 'replay', id: 'replayed' });

    const replayed = await call('replayed', 'canned');
    expect(await replayed.json()).toEqual({ tag: 'canned' });
    expect(backendHits).toEqual([]);

    const recorded = await call('recording', 'live');
    expect(recorded.status).toBe(200);
    expect(backendHits).toEqual([callUrl('live')]);

    await control({ mode: 'transparent' });
    expect(await recordedUrls('recording')).toEqual([callUrl('live')]);
  });

  it('starts a session over when its id is switched to again, as a retried test does', async () => {
    await control({ mode: 'record', id: 'retried' });
    await call('retried', 'attempt1');
    await control({ mode: 'record', id: 'retried' });
    await call('retried', 'attempt2');
    await control({ mode: 'transparent' });
    expect(await recordedUrls('retried')).toEqual([callUrl('attempt2')]);
  });

  it("never lets a retried attempt's late save overwrite the new attempt's file", async () => {
    await control({ mode: 'record', id: 'retried' });
    const slow = call('retried', 'attempt1-slow', 1500, 20_000);
    await reachedBackend('attempt1-slow', 1500);
    const staleCleanup = control({ id: 'retried', cleanup: true });

    await control({ mode: 'record', id: 'retried' });
    await call('retried', 'attempt2');
    await control({ id: 'retried', cleanup: true });
    expect(await recordedUrls('retried')).toEqual([callUrl('attempt2')]);

    await Promise.all([slow, staleCleanup]);
    await control({ mode: 'transparent' });
    expect(await recordedUrls('retried')).toEqual([callUrl('attempt2')]);
  });

  it('files a call with no session id under the one live session, after other sessions have ended', async () => {
    await control({ mode: 'record', id: 'first-test' });
    const headerlessFirst = await call(null, 'ssr-1');
    expect(headerlessFirst.status).toBe(200);
    await control({ id: 'first-test', cleanup: true });

    await control({ mode: 'record', id: 'second-test' });
    const headerlessSecond = await call(null, 'ssr-2');
    expect(headerlessSecond.status).toBe(200);

    await control({ mode: 'transparent' });
    expect(await recordedUrls('first-test')).toEqual([callUrl('ssr-1')]);
    expect(await recordedUrls('second-test')).toEqual([callUrl('ssr-2')]);
  });

  it('refuses a call with no session id while more than one session is live, in either mode', async () => {
    await writeReplayFixture('replayed', 'canned');
    await control({ mode: 'record', id: 'one' });
    await control({ mode: 'record', id: 'two' });
    const ambiguousRecord = await call(null, 'ambiguous');
    expect(ambiguousRecord.status).toBe(400);

    await control({ id: 'two', cleanup: true });
    await control({ mode: 'replay', id: 'replayed' });
    const ambiguousMixed = await call(null, 'canned');
    expect(ambiguousMixed.status).toBe(400);

    await control({ id: 'one', cleanup: true });
    const replayedAlone = await call(null, 'canned');
    expect(await replayedAlone.json()).toEqual({ tag: 'canned' });
    expect(backendHits).toEqual([]);
  });

  it('passes a stray call for an ended session through without touching its file', async () => {
    await control({ mode: 'record', id: 'done' });
    await call('done', 'kept');
    await control({ mode: 'transparent' });
    expect(await recordedUrls('done')).toEqual([callUrl('kept')]);

    await control({ mode: 'record', id: 'later' });
    const stray = await call('done', 'stray');
    expect(stray.status).toBe(200);
    expect(backendHits).toContain(callUrl('stray'));

    await control({ mode: 'transparent' });
    expect(await recordedUrls('done')).toEqual([callUrl('kept')]);
    expect(await recordedUrls('later')).toEqual([]);
  });

  it('ends the sessions before saving, so a call arriving during the save passes through instead of holding it', async () => {
    await control({ mode: 'record', id: 'closing' });
    const inFlight = call('closing', 'before-end', 1000, 20_000);
    await reachedBackend('before-end', 1000);

    const startedAt = Date.now();
    const transparent = control({ mode: 'transparent' }).then(
      () => Date.now() - startedAt,
    );
    await sleep(100);
    const late = call('closing', 'after-end', 3000, 20_000);

    // The switch waits for the call already in flight, not for the one that arrived after it began.
    expect(await transparent).toBeLessThan(2500);
    const lateResponse = await late;
    expect(lateResponse.status).toBe(200);
    await inFlight;
    expect(await recordedUrls('closing')).toEqual([
      callUrl('before-end', 1000),
    ]);
  });

  it("keeps a retried session live for routing after the earlier attempt's stale cleanup", async () => {
    await control({ mode: 'record', id: 'x' });
    await control({ mode: 'record', id: 'y' });
    await control({ mode: 'record', id: 'x' });
    await control({ id: 'x', cleanup: true });

    const ambiguous = await call(null, 'two-live');
    expect(ambiguous.status).toBe(400);

    await control({ id: 'x', cleanup: true });
    const routed = await call(null, 'y-only');
    expect(routed.status).toBe(200);
    await control({ mode: 'transparent' });
    expect(await recordedUrls('y')).toEqual([callUrl('y-only')]);
  });

  it('does not let a client that aborts mid-upload hold the session open', async () => {
    await control({ mode: 'record', id: 'aborted' });
    await new Promise<void>((resolve) => {
      const socket = net.connect(PROXY_PORT, 'localhost', () => {
        socket.write(
          `POST /slow?ms=0&tag=partial HTTP/1.1\r\nHost: localhost\r\n${RECORDING_ID_HEADER}: aborted\r\nContent-Length: 20\r\n\r\nhello`,
        );
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 50);
      });
    });
    await sleep(50);

    const ended = await Promise.race([
      control({ mode: 'transparent' }).then(() => 'ended'),
      sleep(2000).then(() => 'stuck'),
    ]);
    expect(ended).toBe('ended');
  });
});
