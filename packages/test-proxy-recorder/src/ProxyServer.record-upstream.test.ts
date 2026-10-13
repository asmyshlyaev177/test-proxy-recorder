import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from './constants.js';
import { MAX_DECODED_BYTES } from './httpRecorder.js';
import { ProxyServer } from './ProxyServer.js';

// Record mode and transparent mode both reach the upstream through http-proxy, but record
// mode buffers both bodies and sets its own options. These cases pin the upstream path, the
// Host and accept-encoding headers it sends, TLS, and how a compressed body is stored.

const RECORDINGS_DIR = path.join(
  process.cwd(),
  'test-recordings-record-upstream',
);
const PROXY_PORT = 9900;
const BACKEND_PORT = 9901;
const NETWORK_PROXY_PORT = 9902;
const proxyUrl = `http://localhost:${PROXY_PORT}`;
const SESSION = 'upstream';
const PLAIN_BODY = '{"plain":true}';

type Seen = {
  url: string;
  host: string | undefined;
  acceptEncoding: string | undefined;
};
type StoredRecording = {
  request: { url: string };
  response: {
    statusCode: number;
    body: string | null;
    headers: Record<string, string>;
  };
};
type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};
type Tls = { key: string; cert: string };
type Harness = {
  seen: Seen[];
  // Emits each request URL once the backend has written its whole response.
  sent: EventTarget;
  close: () => Promise<void>;
};

const COMPRESSED: Record<string, (body: Buffer) => Buffer> = {
  gzip: (body) => zlib.gzipSync(body),
  deflate: (body) => zlib.deflateSync(body),
  br: (body) => zlib.brotliCompressSync(body),
};

// Bodies whose bytes don't match their Content-Encoding the way zlib expects, as some servers send.
const MISLABELED: Record<string, { encoding: string; body: Buffer }> = {
  '/enc/raw-deflate': {
    encoding: 'deflate',
    body: zlib.deflateRawSync(Buffer.from('{"raw":true}')),
  },
  '/enc/broken-gzip': {
    encoding: 'gzip',
    body: Buffer.from('not gzip at all'),
  },
};

const gzippedZerosBySize = new Map<number, Buffer>();

function getGzippedZeros(size: number): Buffer {
  const cached = gzippedZerosBySize.get(size);
  if (cached) return cached;
  const gzipped = zlib.gzipSync(Buffer.alloc(size));
  gzippedZerosBySize.set(size, gzipped);
  return gzipped;
}

function answerRoute(
  route: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const zerosSize = /^\/enc\/zeros-(\d+)$/.exec(route)?.[1];
  if (zerosSize) {
    res.writeHead(200, { 'Content-Encoding': 'gzip' });
    res.end(getGzippedZeros(Number(zerosSize)));
    return;
  }
  const mislabeled = MISLABELED[route];
  if (mislabeled) {
    res.writeHead(200, { 'Content-Encoding': mislabeled.encoding });
    res.end(mislabeled.body);
    return;
  }
  const encoded = COMPRESSED[route.replace('/enc/', '')];
  if (encoded) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Encoding': route.replace('/enc/', ''),
      'Transfer-Encoding': 'chunked',
    });
    res.end(encoded(Buffer.from(JSON.stringify({ encoding: route }))));
    return;
  }
  if (route === '/enc/empty-204') {
    res.writeHead(204, { 'Content-Encoding': 'gzip' });
    res.end();
    return;
  }
  if (route === '/enc/empty-200') {
    res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': '0' });
    res.end();
    return;
  }
  if (route === '/enc/identity' || route === '/enc/x-custom') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Encoding': route.replace('/enc/', ''),
      'Transfer-Encoding': 'chunked',
    });
    res.end('as-is');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(PLAIN_BODY)),
  });
  res.end(req.method === 'HEAD' ? undefined : PLAIN_BODY);
}

let harness: Harness | undefined;

// The backend answers 404 outside its base path, so an unprefixed upstream path
// is visible in the recorded status and not only in `seen`.
async function start(
  target: string,
  backendBasePath = '',
  tls?: Tls,
): Promise<Harness> {
  await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
  const seen: Seen[] = [];
  const sent = new EventTarget();
  const handle: http.RequestListener = (req, res) => {
    const url = req.url!;
    res.on('finish', () => sent.dispatchEvent(new Event(url)));
    seen.push({
      url,
      host: req.headers.host,
      acceptEncoding: req.headers['accept-encoding'] as string | undefined,
    });
    if (backendBasePath && !url.startsWith(`${backendBasePath}/`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const route = url.slice(backendBasePath.length).split('?')[0]!;
    answerRoute(route, req, res);
  };
  const backend = tls
    ? https.createServer(tls, handle)
    : http.createServer(handle);
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, resolve));
  const server = new ProxyServer(target, RECORDINGS_DIR);
  await server.init();
  const proxy = server.listen(PROXY_PORT);
  await new Promise<void>((resolve) => proxy.once('listening', resolve));
  harness = {
    seen,
    sent,
    close: async () => {
      proxy.closeAllConnections();
      await new Promise((resolve) => proxy.close(resolve));
      await new Promise((resolve) => backend.close(resolve));
      await fs.rm(RECORDINGS_DIR, { recursive: true, force: true });
    },
  };
  return harness;
}

afterEach(async () => {
  await harness?.close();
  harness = undefined;
});

async function setMode(base: string, mode: string, id?: string): Promise<void> {
  const res = await fetch(`${base}/__control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, id }),
  });
  expect(res.status).toBe(200);
}

function inSession(urlPath: string, init: RequestInit = {}) {
  return fetch(`${proxyUrl}${urlPath}`, {
    ...init,
    headers: { [RECORDING_ID_HEADER]: SESSION, ...init.headers },
    signal: AbortSignal.timeout(3000),
  });
}

async function readStored(dir: string, id: string): Promise<StoredRecording[]> {
  const file = JSON.parse(
    await fs.readFile(path.join(dir, `${id}.mock.json`), 'utf8'),
  ) as {
    recordings: StoredRecording[];
  };
  return file.recordings;
}

// Resolves when the response headers arrive, which the proxy writes only once decoding is done.
function requestHeaders(urlPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: 'localhost',
        port: PROXY_PORT,
        path: urlPath,
        headers: { [RECORDING_ID_HEADER]: SESSION },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode!);
      },
    );
    req.on('error', reject);
  });
}

// fetch would decode the body itself and refuse a broken one; this reads the bytes as relayed.
function rawRequest(
  urlPath: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port: PROXY_PORT,
        path: urlPath,
        headers: { [RECORDING_ID_HEADER]: SESSION, ...headers },
        timeout: 3000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode!,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('proxy did not answer')));
    req.on('error', reject);
    req.end();
  });
}

function createSelfSignedCert(): Tls {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tpr-cert-'));
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  try {
    // An EC key keeps generation fast; the cert only has to outlive one run.
    execFileSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- test-only, fixed arguments; CI images ship openssl
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
      ],
      { stdio: 'ignore' },
    );
    return {
      key: readFileSync(keyPath, 'utf8'),
      cert: readFileSync(certPath, 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Switching to replay saves the record session, so the file exists from then on.
async function recordThenReplay(urlPath: string, init?: RequestInit) {
  await setMode(proxyUrl, 'record', SESSION);
  const recorded = await inSession(urlPath, init);
  await recorded.arrayBuffer();
  await setMode(proxyUrl, 'replay', SESSION);
  const stored = await readStored(RECORDINGS_DIR, SESSION);
  const replayed = await inSession(urlPath, init);
  return { recorded, stored, replayed };
}

describe('record mode upstream path', () => {
  it('joins a target path with a trailing slash to the request path with one slash', async () => {
    const { seen } = await start(
      `http://localhost:${BACKEND_PORT}/api/v1/`,
      '/api/v1',
    );
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/chat/completions');
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe('/api/v1/chat/completions');
  });

  it('sends the request path unchanged when the target has no path', async () => {
    const { seen } = await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/chat/completions');
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe('/chat/completions');
  });

  it('keeps the query string after the prefixed path', async () => {
    const { seen } = await start(
      `http://localhost:${BACKEND_PORT}/api/v1`,
      '/api/v1',
    );
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/models?limit=1&order=asc');
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe('/api/v1/models?limit=1&order=asc');
  });

  it('prefixes a target path of several segments', async () => {
    const { seen } = await start(
      `http://localhost:${BACKEND_PORT}/base/api/v1`,
      '/base/api/v1',
    );
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/models');
    expect(res.status).toBe(200);
    expect(seen[0]?.url).toBe('/base/api/v1/models');
  });

  it.each([
    ['/api/v1/', '/models'],
    ['/api/v1//', '//models'],
    ['/api/v1', '/a//b?q=x//y'],
    ['', '//models'],
  ])(
    'reaches the same upstream path as transparent mode for target path "%s" and request %s',
    async (targetPath, urlPath) => {
      const { seen } = await start(
        `http://localhost:${BACKEND_PORT}${targetPath}`,
      );
      const transparent = await inSession(urlPath);
      await transparent.arrayBuffer();
      await setMode(proxyUrl, 'record', SESSION);
      const recorded = await inSession(urlPath);
      await recorded.arrayBuffer();
      expect(seen).toHaveLength(2);
      expect(seen[1]?.url).toBe(seen[0]?.url);
    },
  );

  it('reaches the same upstream path as transparent mode for an absolute-form request', async () => {
    const { seen } = await start(`http://localhost:${BACKEND_PORT}/api/v1`);
    const absolute = `http://localhost:${PROXY_PORT}/models?limit=1`;
    await rawRequest(absolute);
    await setMode(proxyUrl, 'record', SESSION);
    await rawRequest(absolute);
    expect(seen.map((s) => s.url)).toEqual([
      '/api/v1/models?limit=1',
      '/api/v1/models?limit=1',
    ]);
  });

  it('replays a prefixed route under the path the client sent', async () => {
    await start(`http://localhost:${BACKEND_PORT}/api/v1`, '/api/v1');
    const { recorded, stored, replayed } =
      await recordThenReplay('/models?limit=1');
    expect(recorded.status).toBe(200);
    expect(stored[0]?.request.url).toBe('/models?limit=1');
    expect(replayed.status).toBe(200);
    expect(await replayed.text()).toBe(PLAIN_BODY);
  });
});

describe('record mode upstream headers', () => {
  it('sends the target host, with port, as Host whatever Host the client sent', async () => {
    const { seen } = await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const { status } = await rawRequest('/models', {
      host: 'proxy.example.test:8100',
    });
    expect(status).toBe(200);
    expect(seen[0]?.host).toBe(`localhost:${BACKEND_PORT}`);
  });

  it('asks the upstream for an identity body when the client accepts gzip, deflate and br', async () => {
    const { seen } = await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/models', {
      headers: { 'accept-encoding': 'gzip, deflate, br' },
    });
    expect(res.status).toBe(200);
    expect(seen[0]?.acceptEncoding).toBe('identity');
  });
});

describe('record mode compressed bodies', () => {
  it.each(['gzip', 'deflate', 'br'])(
    'stores a %s body as text without its encoding headers and replays it readable',
    async (encoding) => {
      await start(`http://localhost:${BACKEND_PORT}`);
      const { recorded, stored, replayed } = await recordThenReplay(
        `/enc/${encoding}`,
      );
      expect(recorded.status).toBe(200);
      expect(stored[0]?.response.body).toBe(`{"encoding":"/enc/${encoding}"}`);
      expect(stored[0]?.response.headers).not.toHaveProperty(
        'content-encoding',
      );
      expect(stored[0]?.response.headers).not.toHaveProperty(
        'transfer-encoding',
      );
      expect(stored[0]?.response.headers).not.toHaveProperty('content-length');
      expect(replayed.status).toBe(200);
      expect(await replayed.json()).toEqual({ encoding: `/enc/${encoding}` });
    },
  );

  it('relays a decoded body with the content-length of the decoded bytes', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const res = await inSession('/enc/gzip');
    const body = await res.text();
    expect(body).toBe('{"encoding":"/enc/gzip"}');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBe(
      String(Buffer.byteLength(body)),
    );
  });

  it('stores a 204 marked gzip as a null body', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    const { recorded, stored, replayed } =
      await recordThenReplay('/enc/empty-204');
    expect(recorded.status).toBe(204);
    expect(stored[0]?.response.statusCode).toBe(204);
    expect(stored[0]?.response.body).toBeNull();
    expect(replayed.status).toBe(204);
  });

  it('stores a 200 with zero bytes marked gzip as a null body', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    const { recorded, stored, replayed } =
      await recordThenReplay('/enc/empty-200');
    expect(recorded.status).toBe(200);
    expect(stored[0]?.response.body).toBeNull();
    expect(replayed.status).toBe(200);
    expect(await replayed.text()).toBe('');
  });

  it.each(['identity', 'x-custom'])(
    'stores a body with content-encoding %s as-is and keeps that header',
    async (encoding) => {
      await start(`http://localhost:${BACKEND_PORT}`);
      const { stored } = await recordThenReplay(`/enc/${encoding}`);
      expect(stored[0]?.response.body).toBe('as-is');
      expect(stored[0]?.response.headers['content-encoding']).toBe(encoding);
      expect(stored[0]?.response.headers).not.toHaveProperty(
        'transfer-encoding',
      );
    },
  );

  it('stores deflate sent without the zlib header as text', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const relayed = await rawRequest('/enc/raw-deflate');
    await setMode(proxyUrl, 'transparent');
    const stored = await readStored(RECORDINGS_DIR, SESSION);
    expect(relayed.body.toString('utf8')).toBe('{"raw":true}');
    expect(relayed.headers['content-encoding']).toBeUndefined();
    expect(stored[0]?.response.body).toBe('{"raw":true}');
  });

  it('relays and stores a body that fails to decode as it arrived, with its encoding header', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const relayed = await rawRequest('/enc/broken-gzip');
    await setMode(proxyUrl, 'transparent');
    const stored = await readStored(RECORDINGS_DIR, SESSION);
    expect(relayed.status).toBe(200);
    expect(relayed.headers['content-encoding']).toBe('gzip');
    expect(relayed.body.toString('utf8')).toBe('not gzip at all');
    expect(stored[0]?.response.body).toBe('not gzip at all');
    expect(stored[0]?.response.headers['content-encoding']).toBe('gzip');
  });

  it('keeps the recorded content-length of a HEAD response', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    const { recorded, stored, replayed } = await recordThenReplay('/models', {
      method: 'HEAD',
    });
    const length = String(Buffer.byteLength(PLAIN_BODY));
    expect(recorded.status).toBe(200);
    expect(stored[0]?.response.headers['content-length']).toBe(length);
    expect(replayed.headers.get('content-length')).toBe(length);
  });
});

describe('record mode against an HTTPS target with a self-signed certificate', () => {
  it('records it as transparent mode proxies it, without verifying the certificate', async () => {
    await start(
      `https://localhost:${BACKEND_PORT}`,
      '',
      createSelfSignedCert(),
    );
    const transparent = await inSession('/models');
    expect(transparent.status).toBe(200);
    await transparent.arrayBuffer();
    const { recorded, stored } = await recordThenReplay('/models');
    expect(recorded.status).toBe(200);
    expect(stored[0]?.response.body).toBe(PLAIN_BODY);
  });
});

describe('record mode decoding of large bodies', () => {
  const atCap = `/enc/zeros-${MAX_DECODED_BYTES}`;
  const pastCap = `/enc/zeros-${MAX_DECODED_BYTES + 1}`;

  it('answers another request while a large body decodes', async () => {
    const { sent } = await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const answered: string[] = [];
    const largeSent = once(sent, atCap);
    const large = requestHeaders(atCap).then(() => answered.push('large'));
    // The small request reaches the proxy only after the large compressed body has left the backend.
    await largeSent;
    const small = requestHeaders('/models').then(() => answered.push('small'));
    await Promise.all([large, small]);
    expect(answered).toEqual(['small', 'large']);
  });

  it('decodes a body of exactly MAX_DECODED_BYTES', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const relayed = await rawRequest(atCap);
    expect(relayed.headers['content-encoding']).toBeUndefined();
    expect(relayed.body.length).toBe(MAX_DECODED_BYTES);
  });

  it('relays a body that decodes past MAX_DECODED_BYTES as it arrived', async () => {
    await start(`http://localhost:${BACKEND_PORT}`);
    await setMode(proxyUrl, 'record', SESSION);
    const relayed = await rawRequest(pastCap);
    expect(relayed.headers['content-encoding']).toBe('gzip');
    expect(relayed.body.equals(getGzippedZeros(MAX_DECODED_BYTES + 1))).toBe(
      true,
    );
  });
});

// A CDN-fronted HTTPS API behind a path is the case that found the Host bug:
// the forwarded `localhost:<port>` Host became the TLS server name.
describe('record mode against a real HTTPS target (needs TPR_NETWORK_TESTS=1)', () => {
  const networkDir = path.join(
    process.cwd(),
    'test-recordings-record-upstream-network',
  );
  const networkUrl = `http://localhost:${NETWORK_PROXY_PORT}`;

  it.skipIf(!process.env.TPR_NETWORK_TESTS)(
    'records https://openrouter.ai/api/v1 GET /models?limit=1 as JSON text (skipped unless TPR_NETWORK_TESTS is set)',
    async () => {
      await fs.rm(networkDir, { recursive: true, force: true });
      const server = new ProxyServer(
        'https://openrouter.ai/api/v1',
        networkDir,
      );
      await server.init();
      const proxy = server.listen(NETWORK_PROXY_PORT);
      await new Promise<void>((resolve) => proxy.once('listening', resolve));
      try {
        await setMode(networkUrl, 'record', SESSION);
        const res = await fetch(`${networkUrl}/models?limit=1`, {
          headers: {
            [RECORDING_ID_HEADER]: SESSION,
            'accept-encoding': 'gzip, deflate, br',
          },
          signal: AbortSignal.timeout(15_000),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveProperty('data');
        await setMode(networkUrl, 'transparent');
        const stored = await readStored(networkDir, SESSION);
        expect(stored[0]?.response.statusCode).toBe(200);
        expect(stored[0]?.response.body?.startsWith('{')).toBe(true);
        expect(JSON.parse(stored[0]!.response.body!)).toHaveProperty('data');
        expect(stored[0]?.response.headers).not.toHaveProperty(
          'content-encoding',
        );
      } finally {
        proxy.closeAllConnections();
        await new Promise((resolve) => proxy.close(resolve));
        await fs.rm(networkDir, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
