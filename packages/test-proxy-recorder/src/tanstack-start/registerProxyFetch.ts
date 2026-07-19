import { patchGlobalFetch } from '../patchFetch.js';
import { isRecorderEnabled } from '../recorderEnabled.js';
import { currentRecordingId } from './requestContext.js';

/**
 * Patch the global `fetch` so every server-side request carries the current
 * request's recording id (`x-test-rcrd-id`).
 *
 * TanStack Start runs route loaders, server functions and server routes on the
 * server, so their `fetch()` calls to the proxy have no browser context. Under
 * parallel replay the proxy can only tell concurrent test sessions apart if each
 * SSR request carries its recording id. Patching `fetch` once tags them all
 * automatically — no per-call helper needed. (See {@link createHeadersWithRecordingId}
 * for the manual alternative.)
 *
 * Call it once in server-scoped module code. The simplest place is the top of
 * `src/router.tsx`, which runs on the server for every SSR request:
 *
 * ```ts
 * import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';
 * registerProxyFetch();
 * ```
 *
 * Idempotent, and a no-op on the client (there is no server request context to
 * read). No-op in production unless `TEST_PROXY_RECORDER_ENABLED` is set.
 */
export function registerProxyFetch(): void {
  if (!isRecorderEnabled()) return;
  // Client has no server request context to read; nothing to tag.
  if ((globalThis as { window?: unknown }).window !== undefined) return;

  patchGlobalFetch(currentRecordingId);
}
