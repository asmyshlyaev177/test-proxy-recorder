import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Stand in for `@tanstack/react-start/server`, which isn't a dependency of this
// package. The mutable state lets each test control what the "current request"
// exposes — including throwing, which is how the server helpers behave outside a
// request scope (build-time / non-request fetches).
const mockState = vi.hoisted(() => ({
  headerValue: null as string | null,
  shouldThrow: false,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: (name: string) => {
    if (mockState.shouldThrow) {
      throw new Error('getRequestHeader called outside a request scope');
    }
    return name === 'x-test-rcrd-id'
      ? (mockState.headerValue ?? undefined)
      : undefined;
  },
}));

import { registerProxyFetch } from './registerProxyFetch.js';

const HEADER = 'x-test-rcrd-id';

describe('tanstack-start registerProxyFetch', () => {
  let realFetch: typeof globalThis.fetch;
  let original: ReturnType<typeof vi.fn>;
  let nodeEnvBackup: string | undefined;
  let enabledBackup: string | undefined;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    original = vi.fn(async () => new Response('ok'));
    globalThis.fetch = original as unknown as typeof globalThis.fetch;

    mockState.headerValue = null;
    mockState.shouldThrow = false;

    nodeEnvBackup = process.env.NODE_ENV;
    enabledBackup = process.env.TEST_PROXY_RECORDER_ENABLED;
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_PROXY_RECORDER_ENABLED;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    restoreEnv('NODE_ENV', nodeEnvBackup);
    restoreEnv('TEST_PROXY_RECORDER_ENABLED', enabledBackup);
    vi.clearAllMocks();
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  function forwardedHeaders(callIndex = 0): Headers {
    const init = original.mock.calls[callIndex]?.[1] as RequestInit | undefined;
    return new Headers(init?.headers ?? {});
  }

  describe('production gate', () => {
    it('does not patch fetch in production without the enable flag', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TEST_PROXY_RECORDER_ENABLED;

      registerProxyFetch();

      expect(globalThis.fetch).toBe(original);
    });

    it('patches fetch in production when TEST_PROXY_RECORDER_ENABLED is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_PROXY_RECORDER_ENABLED = 'true';

      registerProxyFetch();

      expect(globalThis.fetch).not.toBe(original);
    });

    it('patches fetch outside production', () => {
      process.env.NODE_ENV = 'development';

      registerProxyFetch();

      expect(globalThis.fetch).not.toBe(original);
    });
  });

  describe('tagging', () => {
    it('adds the current recording id to an outgoing request', async () => {
      mockState.headerValue = 'session-alpha';
      registerProxyFetch();

      await globalThis.fetch('http://localhost:8110/todos');

      expect(original).toHaveBeenCalledTimes(1);
      expect(forwardedHeaders().get(HEADER)).toBe('session-alpha');
    });

    it('preserves method, body, and existing headers', async () => {
      mockState.headerValue = 'session-x';
      registerProxyFetch();

      await globalThis.fetch('http://localhost:8110/todos', {
        method: 'POST',
        body: '{"text":"buy milk"}',
        headers: { 'content-type': 'application/json' },
      });

      const init = original.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{"text":"buy milk"}');
      const headers = forwardedHeaders();
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get(HEADER)).toBe('session-x');
    });

    it('copies headers from a Request input and adds the id', async () => {
      mockState.headerValue = 'session-req';
      registerProxyFetch();

      const request = new Request('http://localhost:8110/todos', {
        headers: { 'x-custom': 'kept' },
      });
      await globalThis.fetch(request);

      const headers = forwardedHeaders();
      expect(headers.get('x-custom')).toBe('kept');
      expect(headers.get(HEADER)).toBe('session-req');
    });
  });

  describe('when no recording id is available', () => {
    it('leaves the request untouched outside a request scope', async () => {
      mockState.shouldThrow = true; // getRequestHeader throws → no id
      registerProxyFetch();

      await globalThis.fetch('http://localhost:8110/todos', {
        headers: { 'content-type': 'application/json' },
      });

      const headers = forwardedHeaders();
      expect(headers.has(HEADER)).toBe(false);
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('leaves the request untouched when the header is absent', async () => {
      mockState.headerValue = null;
      registerProxyFetch();

      await globalThis.fetch('http://localhost:8110/todos');

      expect(forwardedHeaders().has(HEADER)).toBe(false);
    });
  });

  it('does not overwrite an id the caller already set', async () => {
    mockState.headerValue = 'auto-id';
    registerProxyFetch();

    await globalThis.fetch('http://localhost:8110/todos', {
      headers: { [HEADER]: 'explicit-id' },
    });

    expect(forwardedHeaders().get(HEADER)).toBe('explicit-id');
  });

  it('is idempotent — patching twice does not double-wrap', async () => {
    mockState.headerValue = 'session-x';
    registerProxyFetch();
    const wrapper = globalThis.fetch;

    registerProxyFetch();

    expect(globalThis.fetch).toBe(wrapper);

    await globalThis.fetch('http://localhost:8110/todos');
    expect(original).toHaveBeenCalledTimes(1);
    expect(forwardedHeaders().get(HEADER)).toBe('session-x');
  });

  describe('against a real server (patched genuine fetch)', () => {
    let server: Server;
    let baseUrl = '';
    let lastRequestId: string | undefined;

    beforeAll(async () => {
      server = createServer((req, res) => {
        lastRequestId = req.headers[HEADER] as string | undefined;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    beforeEach(() => {
      globalThis.fetch = realFetch;
      lastRequestId = undefined;
    });

    it('sends the recording id header over the wire', async () => {
      mockState.headerValue = 'session-wire';
      registerProxyFetch();

      const res = await globalThis.fetch(`${baseUrl}/todos`);

      expect(res.status).toBe(200);
      expect(lastRequestId).toBe('session-wire');
    });

    it('sends no recording id header when there is none', async () => {
      mockState.shouldThrow = true;
      registerProxyFetch();

      const res = await globalThis.fetch(`${baseUrl}/todos`);

      expect(res.status).toBe(200);
      expect(lastRequestId).toBeUndefined();
    });
  });
});
