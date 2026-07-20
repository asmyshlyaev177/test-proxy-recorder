import { RECORDING_ID_HEADER } from '../constants.js';
import { patchGlobalFetch } from '../patchFetch.js';
import { isRecorderEnabled } from '../recorderEnabled.js';

/**
 * Read the recording id off the request currently being rendered. Returns null
 * outside a request scope (e.g. build-time fetches), where `next/headers` is
 * unavailable — those fetches are left untouched.
 *
 * Exported for reuse by other server-side taggers (e.g. {@link registerProxyAxios});
 * not part of the public API surface (it isn't re-exported from the entry point).
 */
export async function currentRecordingId(): Promise<string | null> {
  try {
    // Resolved through a variable so bundlers leave it as a runtime import:
    // `next/headers` only exists in the consuming Next.js app, not this package.
    const specifier = 'next/headers';
    const nextHeaders = await import(specifier);

    const headerStore = await nextHeaders.headers();
    return headerStore.get(RECORDING_ID_HEADER);
  } catch {
    return null;
  }
}

/**
 * Patch the global `fetch` so every server-side request carries the current
 * session's recording id (`x-test-rcrd-id`).
 *
 * Playwright sets that header on the browser, so document navigations reach SSR.
 * But a Server Component's own `fetch()` to the proxy is a fresh request that
 * doesn't inherit it — under parallel replay the proxy then can't tell which
 * recording to serve. `setNextProxyHeaders` middleware covers most cases, but on
 * the Edge runtime its context differs from the one rendering your routes.
 * Patching `fetch` once, in the right place, covers everything.
 *
 * Call it at the top level of your root layout (`app/layout.tsx`) — not
 * `instrumentation.ts`, whose `register()` runs in a different context on the
 * Edge runtime and patches the wrong `globalThis.fetch`:
 *
 * ```ts
 * import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
 * registerProxyFetch();
 * ```
 *
 * Idempotent. No-op in production unless `TEST_PROXY_RECORDER_ENABLED` is set.
 */
export function registerProxyFetch(): void {
  if (!isRecorderEnabled()) return;
  patchGlobalFetch(currentRecordingId);
}
