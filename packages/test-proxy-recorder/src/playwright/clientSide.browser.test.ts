import { promises as fs } from 'node:fs';
import http from 'node:http';
import type net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { type Browser, chromium, type Page } from '@playwright/test';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { PROXY_PORT_ENV } from '../constants.js';
import { ProxyServer } from '../ProxyServer.js';
import type { Mode } from '../types';
import {
  __resetProxyCachesForTests,
  playwrightProxy,
  type PlaywrightTestInfo,
} from './index.js';

// Real Chromium, a real proxy for the control calls, and a small task-list API
// the page talks to directly: the HAR path exists for hosts the proxy never sees.

const LAUNCH_TIMEOUT = 60_000;
const SESSION_TIMEOUT = 30_000;

function listening(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.on('listening', () =>
      resolve((server.address() as net.AddressInfo).port),
    );
  });
}

function close(server: http.Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

interface Reads {
  before: number;
  after: number;
}

/** Reads `before` times, adds "milk", reads `after` times; returns every list the page saw. */
function runPage(page: Page, reads: Reads): Promise<string[][]> {
  return page.evaluate(async ({ before, after }) => {
    const seen: string[][] = [];
    const read = async () => {
      const response = await fetch('/todos');
      seen.push((await response.json()) as string[]);
    };
    for (let i = 0; i < before; i++) await read();
    await fetch('/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'milk' }),
    });
    for (let i = 0; i < after; i++) await read();
    return seen;
  }, reads);
}

describe('client-side replay through playwrightProxy.before', () => {
  let browser: Browser;
  let api: http.Server;
  let apiOrigin: string;
  let apiUrl: RegExp;
  let proxyHttp: http.Server;
  let recordingsDir: string;
  let todos: string[] = [];
  let apiHits = 0;

  function redirect(res: http.ServerResponse, status: number, to: string) {
    res.statusCode = status;
    res.setHeader('location', to);
    res.end();
  }

  function handleApi(req: http.IncomingMessage, res: http.ServerResponse) {
    apiHits++;
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><title>todos</title>');
      return;
    }
    // The trailing-slash redirect FastAPI and Django send, and a moved page.
    if (req.url === '/todos/') return redirect(res, 307, '/todos');
    if (req.url === '/old') return redirect(res, 302, '/');
    res.setHeader('content-type', 'application/json');
    if (req.method !== 'POST') {
      res.end(JSON.stringify(todos));
      return;
    }
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk));
    req.on('end', () => {
      todos.push((JSON.parse(raw) as { text: string }).text);
      res.statusCode = 201;
      res.end(JSON.stringify(todos));
    });
  }

  beforeAll(async () => {
    browser = await chromium.launch();
    api = http.createServer(handleApi);
    api.listen(0);
    const apiPort = await listening(api);
    apiOrigin = `http://127.0.0.1:${apiPort}`;
    apiUrl = new RegExp(String.raw`127\.0\.0\.1:${apiPort}`);
  }, LAUNCH_TIMEOUT);

  // A failed launch leaves both unset; closing them would hide the launch error.
  afterAll(async () => {
    await browser?.close();
    if (api) await close(api);
  });

  beforeEach(async () => {
    todos = [];
    apiHits = 0;
    recordingsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tpr-har-'));
    const proxy = new ProxyServer(apiOrigin, recordingsDir);
    await proxy.init();
    proxyHttp = proxy.listen(0);
    process.env[PROXY_PORT_ENV] = String(await listening(proxyHttp));
    __resetProxyCachesForTests();
  });

  afterEach(async () => {
    await close(proxyHttp);
    delete process.env[PROXY_PORT_ENV];
    await fs.rm(recordingsDir, { recursive: true, force: true });
  });

  const testInfo = (title: string): PlaywrightTestInfo => ({
    title,
    titlePath: ['client-side.spec.ts', title],
  });

  /** One browser context under `before()`, closed at the end so the HAR is flushed. */
  async function session<T>(
    mode: Mode,
    title: string,
    act: (page: Page) => Promise<T>,
  ): Promise<T> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await playwrightProxy.before(page, testInfo(title), mode, { url: apiUrl });
    const result = await act(page);
    await context.close();
    return result;
  }

  async function record<T>(
    title: string,
    act: (page: Page) => Promise<T>,
  ): Promise<T> {
    const result = await session('record', title, act);
    todos = [];
    apiHits = 0;
    return result;
  }

  const readsThenWrite = (reads: Reads) => async (page: Page) => {
    await page.goto(`${apiOrigin}/`);
    return runPage(page, reads);
  };

  it(
    'serves a read after a write the state the write produced, without reaching the API',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'read write read';
      const act = readsThenWrite({ before: 1, after: 1 });
      expect(await record(title, act)).toEqual([[], ['milk']]);

      const replayed = await session('replay', title, act);

      expect(replayed).toEqual([[], ['milk']]);
      expect(apiHits).toBe(0);
    },
  );

  it(
    'copes with the replay reading fewer times before the write than the recording did',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'fewer reads';
      await record(title, readsThenWrite({ before: 2, after: 1 }));

      const replayed = await session(
        'replay',
        title,
        readsThenWrite({ before: 1, after: 1 }),
      );

      expect(replayed).toEqual([[], ['milk']]);
      expect(apiHits).toBe(0);
    },
  );

  it(
    'copes with the replay reading more times before the write than the recording did',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'more reads';
      await record(title, readsThenWrite({ before: 1, after: 1 }));

      const replayed = await session(
        'replay',
        title,
        readsThenWrite({ before: 2, after: 1 }),
      );

      expect(replayed).toEqual([[], [], ['milk']]);
      expect(apiHits).toBe(0);
    },
  );

  it(
    'follows a recorded redirect inside the HAR instead of reaching the API',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'redirect';
      const act = async (page: Page) => {
        await page.goto(`${apiOrigin}/`);
        return page.evaluate(async () => {
          const response = await fetch('/todos/');
          return { status: response.status, body: await response.json() };
        });
      };
      expect(await record(title, act)).toEqual({ status: 200, body: [] });

      const replayed = await session('replay', title, act);

      expect(replayed).toEqual({ status: 200, body: [] });
      expect(apiHits).toBe(0);
    },
  );

  it(
    'sends a navigation recorded as a redirect on to its target',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'moved page';
      const act = async (page: Page) => {
        await page.goto(`${apiOrigin}/old`);
        await page.waitForURL(`${apiOrigin}/`);
        return page.title();
      };
      expect(await record(title, act)).toBe('todos');

      const replayed = await session('replay', title, act);

      expect(replayed).toBe('todos');
      expect(apiHits).toBe(0);
    },
  );

  it(
    'fails a request the recording does not hold instead of reaching the API',
    { timeout: SESSION_TIMEOUT },
    async () => {
      const title = 'unrecorded';
      await record(title, readsThenWrite({ before: 1, after: 0 }));

      const outcome = await session('replay', title, async (page) => {
        await page.goto(`${apiOrigin}/`);
        return page.evaluate(() =>
          fetch('/todos', { method: 'DELETE' }).then(
            () => 'ok',
            (error: Error) => error.message,
          ),
        );
      });

      expect(outcome).toBe('Failed to fetch');
      expect(apiHits).toBe(0);
    },
  );
});
