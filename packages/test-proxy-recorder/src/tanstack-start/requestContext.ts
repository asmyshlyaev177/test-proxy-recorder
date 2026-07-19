import { RECORDING_ID_HEADER } from '../constants.js';
import { isRecorderEnabled } from '../recorderEnabled.js';

/**
 * Read the current request's recording id (`x-test-rcrd-id`) from TanStack
 * Start's server request context.
 *
 * TanStack Start keeps the in-flight request in an async-local context that
 * `@tanstack/react-start/server` exposes via `getRequestHeader()`. That context
 * is active throughout SSR — route loaders, server functions, and server routes
 * — which is exactly where server-side `fetch` calls to the proxy happen.
 *
 * Returns `null` outside a request scope (e.g. build-time / prerender fetches, or
 * on the client), where the server helpers are unavailable — those fetches are
 * left untouched.
 *
 * The specifier is resolved through a variable so bundlers leave it as a runtime
 * import: `@tanstack/react-start/server` only exists in the consuming app, not in
 * this package, and it must never be pulled into the client bundle.
 */
export async function currentRecordingId(): Promise<string | null> {
  try {
    const specifier = '@tanstack/react-start/server';
    const server = (await import(specifier)) as {
      getRequestHeader?: (name: string) => string | undefined;
    };
    return server.getRequestHeader?.(RECORDING_ID_HEADER) ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the recording id for the request currently being handled, or `null`.
 *
 * Use this when you want to forward the id onto a server-side `fetch` by hand
 * instead of patching the global `fetch` with {@link registerProxyFetch}. No-op
 * (returns `null`) in production unless `TEST_PROXY_RECORDER_ENABLED` is set.
 *
 * @example
 * // Inside a route loader or server function
 * import { getRecordingId } from 'test-proxy-recorder/tanstack-start';
 *
 * const id = await getRecordingId();
 * const res = await fetch('http://localhost:8100/todos', {
 *   headers: { ...(id && { 'x-test-rcrd-id': id }) },
 * });
 */
export async function getRecordingId(): Promise<string | null> {
  if (!isRecorderEnabled()) return null;
  return currentRecordingId();
}

/**
 * Build a headers object that carries the current request's recording id,
 * merged with any extra headers you pass. Convenience wrapper around
 * {@link getRecordingId} for the manual-forwarding pattern.
 *
 * No-op (returns `additionalHeaders` unchanged) in production unless
 * `TEST_PROXY_RECORDER_ENABLED` is set.
 *
 * @example
 * import { createHeadersWithRecordingId } from 'test-proxy-recorder/tanstack-start';
 *
 * const res = await fetch('http://localhost:8100/todos', {
 *   headers: await createHeadersWithRecordingId({ 'Content-Type': 'application/json' }),
 * });
 */
export async function createHeadersWithRecordingId(
  additionalHeaders: Record<string, string> = {},
): Promise<Record<string, string>> {
  const recordingId = await getRecordingId();
  return {
    ...additionalHeaders,
    ...(recordingId && { [RECORDING_ID_HEADER]: recordingId }),
  };
}
