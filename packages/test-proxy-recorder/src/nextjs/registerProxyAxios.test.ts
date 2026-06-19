import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
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

/** Build an axios v1 request config with real `AxiosHeaders`. */
function requestConfig(
  init: Record<string, string> = {},
): InternalAxiosRequestConfig {
  return {
    headers: new axios.AxiosHeaders(init),
  } as InternalAxiosRequestConfig;
}

/** The fulfilled half of an axios request interceptor. */
type RequestFulfilled = (
  config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

/**
 * Register the proxy interceptor on a *real* `axios.create()` instance and hand
 * back the fulfilled handler it installed, so a test can drive a request config
 * through it without any network. Spying on `use` keeps us off axios internals.
 */
function registerAndCapture(instance: AxiosInstance) {
  const useSpy = vi.spyOn(instance.interceptors.request, 'use');
  registerProxyAxios(instance);
  const onFulfilled = useSpy.mock.calls.at(-1)?.[0] as
    | RequestFulfilled
    | undefined;
  return {
    useSpy,
    run: async (config = requestConfig()) => {
      if (!onFulfilled) throw new Error('no interceptor registered');
      return (await onFulfilled(config)) as InternalAxiosRequestConfig;
    },
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

// Exercised against *real* `axios.create()` instances of varying shapes. That
// `registerProxyAxios(axios.create())` even compiles is the regression guard for
// the TS2345 a real `AxiosInstance` triggered before `ProxyAxiosInstance` was
// made generic (its interceptor config is the strict `InternalAxiosRequestConfig`,
// not our optional-`headers` shape).
describe('registerProxyAxios — real axios instances (different shapes)', () => {
  let nodeEnvBackup: string | undefined;

  beforeEach(() => {
    mockState.headerValue = 'session-real';
    mockState.shouldThrow = false;
    nodeEnvBackup = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_PROXY_RECORDER_ENABLED;
  });

  afterEach(() => {
    if (nodeEnvBackup === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnvBackup;
    delete (globalThis as { window?: unknown }).window;
    vi.restoreAllMocks();
  });

  it('tags a request on a bare instance (axios.create())', async () => {
    const instance = axios.create();
    const { run } = registerAndCapture(instance);

    const config = await run();

    expect(config.headers.get(HEADER)).toBe('session-real');
  });

  it('tags an instance created with config, leaving its defaults intact', async () => {
    const instance = axios.create({
      baseURL: 'https://api.example.com',
      headers: { 'X-App': 'channels' },
    });
    const { run } = registerAndCapture(instance);

    const config = await run(requestConfig({ 'X-App': 'channels' }));

    expect(config.headers.get(HEADER)).toBe('session-real');
    expect(config.headers.get('X-App')).toBe('channels');
  });

  it('coexists with an existing request interceptor (e.g. auth)', async () => {
    const instance = axios.create();
    const useSpy = vi.spyOn(instance.interceptors.request, 'use');

    // An app-owned interceptor registered before ours, like axiosWithAuth.
    instance.interceptors.request.use((config) => {
      config.headers.set('Authorization', 'Bearer token');
      return config;
    });
    registerProxyAxios(instance);

    // Both interceptors are registered — ours did not replace the app's.
    expect(useSpy).toHaveBeenCalledTimes(2);

    const appInterceptor = useSpy.mock.calls[0][0] as RequestFulfilled;
    const ourInterceptor = useSpy.mock.calls[1][0] as RequestFulfilled;

    // Run them as axios would (LIFO): ours, then the app's.
    let config = await ourInterceptor(requestConfig());
    config = await appInterceptor(config);

    expect(config.headers.get(HEADER)).toBe('session-real');
    expect(config.headers.get('Authorization')).toBe('Bearer token');
  });

  it('registers independently across multiple instances', () => {
    const forServer = axios.create();
    const withAuth = axios.create();
    const serverSpy = vi.spyOn(forServer.interceptors.request, 'use');
    const authSpy = vi.spyOn(withAuth.interceptors.request, 'use');

    registerProxyAxios(forServer);
    registerProxyAxios(withAuth);

    expect(serverSpy).toHaveBeenCalledTimes(1);
    expect(authSpy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent on a real instance — registering twice attaches one', () => {
    const instance = axios.create();
    const useSpy = vi.spyOn(instance.interceptors.request, 'use');

    registerProxyAxios(instance);
    registerProxyAxios(instance);

    expect(useSpy).toHaveBeenCalledTimes(1);
  });

  it('does not attach in production without the enable flag', () => {
    process.env.NODE_ENV = 'production';
    const instance = axios.create();
    const useSpy = vi.spyOn(instance.interceptors.request, 'use');

    registerProxyAxios(instance);

    expect(useSpy).not.toHaveBeenCalled();
  });
});
