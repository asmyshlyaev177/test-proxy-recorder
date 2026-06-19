import { RECORDING_ID_HEADER } from '../constants.js';
import { isRecorderEnabled } from './middleware.js';
import { currentRecordingId } from './registerProxyFetch.js';

/**
 * The subset of an axios request config this interceptor touches. Kept minimal so
 * the package never has to depend on (or pin a version of) axios.
 */
export interface ProxyAxiosRequestConfig {
  headers?: unknown;
}

/**
 * Minimal structural shape of an axios instance — just the request-interceptor
 * registration we need. A real `AxiosInstance` satisfies this.
 */
export interface ProxyAxiosInstance {
  interceptors: {
    request: {
      use(
        onFulfilled: (
          config: ProxyAxiosRequestConfig,
        ) => ProxyAxiosRequestConfig | Promise<ProxyAxiosRequestConfig>,
      ): unknown;
    };
  };
  /** Idempotency marker set after the first registration. */
  __testProxyRecorderPatched?: boolean;
}

/** axios v1 exposes headers as an `AxiosHeaders` instance with `set`/`get`. */
interface AxiosHeadersLike {
  set(name: string, value: string): void;
  get(name: string): unknown;
}

function isAxiosHeaders(headers: unknown): headers is AxiosHeadersLike {
  return (
    typeof headers === 'object' &&
    headers !== null &&
    typeof (headers as AxiosHeadersLike).set === 'function' &&
    typeof (headers as AxiosHeadersLike).get === 'function'
  );
}

function hasHeader(headers: unknown, name: string): boolean {
  if (isAxiosHeaders(headers)) return headers.get(name) != null;
  if (typeof headers === 'object' && headers !== null) {
    return (headers as Record<string, unknown>)[name] != null;
  }
  return false;
}

function setHeader(
  config: ProxyAxiosRequestConfig,
  name: string,
  value: string,
): void {
  if (isAxiosHeaders(config.headers)) {
    config.headers.set(name, value);
    return;
  }
  // Plain-object headers (or none yet) — assign without mutating the original.
  config.headers = {
    ...(typeof config.headers === 'object' && config.headers !== null
      ? (config.headers as Record<string, unknown>)
      : {}),
    [name]: value,
  };
}

/**
 * Attach a request interceptor to an axios instance so every **server-side**
 * request it makes carries the current session's recording id (`x-test-rcrd-id`),
 * letting the proxy tell concurrent replay sessions apart.
 *
 * This is the axios counterpart to {@link registerProxyFetch} (which patches the
 * global `fetch`). Use it for the axios instance(s) your SSR / Server Components
 * make API calls through — it removes the need to hand-roll an interceptor plus a
 * `React.cache()`-memoized `next/headers` reader:
 *
 * ```ts
 * import { registerProxyAxios } from 'test-proxy-recorder/nextjs';
 * registerProxyAxios(axiosForServer);
 * registerProxyAxios(axiosWithAuth);
 * ```
 *
 * - No-op in production unless `TEST_PROXY_RECORDER_ENABLED` is set (the
 *   interceptor is not even attached).
 * - No-op in the browser — the interceptor short-circuits when `window` exists,
 *   and the id is only readable inside a server request scope anyway.
 * - Idempotent per instance: registering the same instance twice attaches one
 *   interceptor.
 * - Never overwrites a recording id a caller set explicitly.
 *
 * @param instance - the axios instance to tag server-side requests on
 */
export function registerProxyAxios(instance: ProxyAxiosInstance): void {
  if (!isRecorderEnabled()) return;
  if (instance.__testProxyRecorderPatched) return;

  instance.interceptors.request.use(async (config) => {
    // Browser requests never carry the id (and `next/headers` is server-only).
    // Referenced via globalThis since this package targets Node (no DOM lib).
    if ((globalThis as { window?: unknown }).window !== undefined)
      return config;

    const recordingId = await currentRecordingId();
    if (recordingId && !hasHeader(config.headers, RECORDING_ID_HEADER)) {
      setHeader(config, RECORDING_ID_HEADER, recordingId);
    }
    return config;
  });

  instance.__testProxyRecorderPatched = true;
}
