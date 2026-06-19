import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ProxyAxiosInstance,
  ProxyAxiosRequestConfig,
} from './registerProxyAxios.js';

// Stand in for `next/headers`, which isn't a dependency of this package. The
// mutable state lets each test control what the "current request" exposes —
// including throwing, which is how `next/headers` behaves outside a request
// scope (build-time / non-request work).
const mockState = vi.hoisted(() => ({
  headerValue: null as string | null,
  shouldThrow: false,
}));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (mockState.shouldThrow) {
      throw new Error('`headers` was called outside a request scope');
    }
    return new Headers(
      mockState.headerValue ? { 'x-test-rcrd-id': mockState.headerValue } : {},
    );
  },
}));

import { registerProxyAxios } from './registerProxyAxios.js';

const HEADER = 'x-test-rcrd-id';

type Interceptor = (
  config: ProxyAxiosRequestConfig,
) => ProxyAxiosRequestConfig | Promise<ProxyAxiosRequestConfig>;

/**
 * A fake axios instance that captures the registered request interceptor so a
 * test can drive a "request" through it and inspect the resulting config.
 */
function makeInstance() {
  let interceptor: Interceptor | undefined;
  const use = vi.fn((onFulfilled: Interceptor) => {
    interceptor = onFulfilled;
  });
  const instance = {
    interceptors: { request: { use } },
  } as unknown as ProxyAxiosInstance;

  return {
    instance,
    use,
    /** Run a request config through the captured interceptor. */
    run: (config: ProxyAxiosRequestConfig) => {
      if (!interceptor) throw new Error('no interceptor registered');
      return interceptor(config);
    },
  };
}

/** A minimal axios-v1 `AxiosHeaders`-like object (has `set`/`get`). */
function axiosHeaders(init: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(init));
  return {
    set: (name: string, value: string) => {
      map.set(name, value);
    },
    get: (name: string) => map.get(name) ?? null,
  };
}

describe('registerProxyAxios', () => {
  let nodeEnvBackup: string | undefined;
  let enabledBackup: string | undefined;

  beforeEach(() => {
    mockState.headerValue = null;
    mockState.shouldThrow = false;

    nodeEnvBackup = process.env.NODE_ENV;
    enabledBackup = process.env.TEST_PROXY_RECORDER_ENABLED;
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_PROXY_RECORDER_ENABLED;
  });

  afterEach(() => {
    restoreEnv('NODE_ENV', nodeEnvBackup);
    restoreEnv('TEST_PROXY_RECORDER_ENABLED', enabledBackup);
    delete (globalThis as { window?: unknown }).window;
    vi.clearAllMocks();
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  describe('production gate', () => {
    it('does not attach an interceptor in production without the enable flag', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TEST_PROXY_RECORDER_ENABLED;
      const { instance, use } = makeInstance();

      registerProxyAxios(instance);

      expect(use).not.toHaveBeenCalled();
    });

    it('attaches in production when TEST_PROXY_RECORDER_ENABLED is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_PROXY_RECORDER_ENABLED = 'true';
      const { instance, use } = makeInstance();

      registerProxyAxios(instance);

      expect(use).toHaveBeenCalledTimes(1);
    });

    it('attaches outside production', () => {
      process.env.NODE_ENV = 'development';
      const { instance, use } = makeInstance();

      registerProxyAxios(instance);

      expect(use).toHaveBeenCalledTimes(1);
    });
  });

  describe('tagging (AxiosHeaders-style config)', () => {
    it('sets the current recording id on an outgoing request', async () => {
      mockState.headerValue = 'session-alpha';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const headers = axiosHeaders();
      const config = await run({ headers });

      expect((config.headers as typeof headers).get(HEADER)).toBe(
        'session-alpha',
      );
    });

    it('preserves existing headers', async () => {
      mockState.headerValue = 'session-x';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const headers = axiosHeaders({ 'content-type': 'application/json' });
      await run({ headers });

      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get(HEADER)).toBe('session-x');
    });

    it('does not overwrite an id the caller already set', async () => {
      mockState.headerValue = 'auto-id';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const headers = axiosHeaders({ [HEADER]: 'explicit-id' });
      await run({ headers });

      expect(headers.get(HEADER)).toBe('explicit-id');
    });
  });

  describe('tagging (plain-object / missing headers)', () => {
    it('sets the id on a plain-object headers config', async () => {
      mockState.headerValue = 'session-plain';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const config = await run({ headers: { 'x-keep': 'yes' } });

      const headers = config.headers as Record<string, unknown>;
      expect(headers['x-keep']).toBe('yes');
      expect(headers[HEADER]).toBe('session-plain');
    });

    it('creates a headers object when the config has none', async () => {
      mockState.headerValue = 'session-none';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const config = await run({});

      expect((config.headers as Record<string, unknown>)[HEADER]).toBe(
        'session-none',
      );
    });

    it('does not overwrite a plain-object id the caller set', async () => {
      mockState.headerValue = 'auto-id';
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const config = await run({ headers: { [HEADER]: 'explicit-id' } });

      expect((config.headers as Record<string, unknown>)[HEADER]).toBe(
        'explicit-id',
      );
    });
  });

  describe('when no recording id is available', () => {
    it('leaves the request untouched outside a request scope', async () => {
      mockState.shouldThrow = true; // headers() throws → no id
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const headers = axiosHeaders({ 'content-type': 'application/json' });
      await run({ headers });

      expect(headers.get(HEADER)).toBeNull();
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('leaves the request untouched when the header is absent', async () => {
      mockState.headerValue = null; // present but empty → no id
      const { instance, run } = makeInstance();
      registerProxyAxios(instance);

      const headers = axiosHeaders();
      await run({ headers });

      expect(headers.get(HEADER)).toBeNull();
    });
  });

  it('is a no-op on the client (window defined)', async () => {
    (globalThis as { window?: unknown }).window = {};
    mockState.headerValue = 'session-x';
    const { instance, run } = makeInstance();
    registerProxyAxios(instance);

    const headers = axiosHeaders();
    await run({ headers });

    expect(headers.get(HEADER)).toBeNull();
  });

  it('is idempotent — registering twice attaches one interceptor', () => {
    const { instance, use } = makeInstance();

    registerProxyAxios(instance);
    registerProxyAxios(instance);

    expect(use).toHaveBeenCalledTimes(1);
  });
});
