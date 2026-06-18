import { RECORDING_ID_HEADER } from '../constants.js';
import { isRecorderEnabled } from './middleware.js';

/**
 * Why this exists
 * ---------------
 * Playwright sets the `x-test-rcrd-id` header on the browser, so browser
 * requests — and the document navigation that triggers SSR — carry it. But a
 * Server Component's `fetch()` to the proxy is a brand-new request created on
 * the server; it does NOT inherit that header. Under parallel replay the proxy
 * then sees several concurrent sessions and an SSR request with no id, and can't
 * tell which recording to serve.
 *
 * The standard fixes (`setNextProxyHeaders` middleware, or manually calling
 * `createHeadersWithRecordingId(await headers())` on every fetch) work, but the
 * manual one is easy to forget and the middleware one only covers the cases it's
 * wired for. `registerProxyFetch` instead patches the global `fetch` once so
 * EVERY server-side fetch is tagged automatically, with no per-call changes.
 *
 * It tags every request-scoped fetch rather than only proxy-bound ones on
 * purpose: the id is inert anywhere but the proxy (other hosts ignore an unknown
 * header), it never affects replay matching (the proxy keys recordings on
 * method + path + query, not headers), and during a test run everything you want
 * recorded already routes through the proxy. So there's nothing to scope.
 *
 * Edge runtime note
 * -----------------
 * This must run in the same module scope as your rendered routes. Call it at the
 * top level of your root layout (`app/layout.tsx`):
 *
 * ```ts
 * import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
 * registerProxyFetch();
 * ```
 *
 * Installing it from `instrumentation.ts`'s `register()` does NOT work on the
 * Edge runtime: that hook runs in a different context than the one rendering
 * your routes, so the `globalThis.fetch` it patches is not the one your Server
 * Components call. The root layout shares the request runtime, so the patch
 * lands on the right `fetch`.
 */
type FetchInput = string | URL | Request;

interface PatchableFetch {
  (input: FetchInput, init?: RequestInit): Promise<Response>;
  __testProxyRecorderPatched?: boolean;
}

/**
 * Read the recording id off the request currently being rendered. Returns null
 * outside a request scope (e.g. build-time fetches), where `next/headers` is
 * unavailable — those fetches are left untouched.
 *
 * Only the `x-test-rcrd-id` header is consulted: Playwright's
 * `setExtraHTTPHeaders` puts it on every browser request, including the document
 * navigation that triggers SSR. (The `proxy-recording-id` cookie that
 * `playwrightProxy.before()` also sets lives on the *proxy* origin for
 * browser→proxy WebSocket handshakes, so it never reaches the app here.)
 */
async function currentRecordingId(): Promise<string | null> {
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
 * Patch the global `fetch` so server-side requests carry the current session's
 * recording id (`x-test-rcrd-id`). Idempotent, and a no-op in production unless
 * `TEST_PROXY_RECORDER_ENABLED` is set. Call once at the top level of your root
 * layout — see the doc comment above for why `instrumentation.ts` is not enough
 * on the Edge runtime.
 */
export function registerProxyFetch(): void {
  if (!isRecorderEnabled()) return;

  const original = globalThis.fetch as PatchableFetch | undefined;
  if (typeof original !== 'function' || original.__testProxyRecorderPatched) {
    return;
  }

  const patched: PatchableFetch = async (input, init) => {
    const recordingId = await currentRecordingId();
    if (!recordingId) {
      return original(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    // Don't clobber an id a caller set explicitly.
    if (!headers.has(RECORDING_ID_HEADER)) {
      headers.set(RECORDING_ID_HEADER, recordingId);
    }
    return original(input, { ...init, headers });
  };

  patched.__testProxyRecorderPatched = true;
  globalThis.fetch = patched;
}
