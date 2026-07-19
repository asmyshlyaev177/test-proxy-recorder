import { RECORDING_ID_HEADER } from './constants.js';

type FetchInput = string | URL | Request;

interface PatchableFetch {
  (input: FetchInput, init?: RequestInit): Promise<Response>;
  __testProxyRecorderPatched?: boolean;
}

/**
 * Patch the global `fetch` so every outgoing request carries the current
 * request's recording id (`x-test-rcrd-id`), obtained from `resolveRecordingId`.
 *
 * Shared by the framework adapters (Next.js, TanStack Start) — they differ only
 * in how they read the id from their server request context. When
 * `resolveRecordingId` returns `null` (outside a request scope) the request is
 * left untouched, and a caller-set id is never overwritten.
 *
 * Fails safe: the recorder must never break the app's real requests. If
 * resolving the id or building the tagged headers throws for any reason, the
 * request falls through to the original `fetch` with the caller's exact
 * arguments — the id simply isn't added.
 *
 * Idempotent: patching an already-patched `fetch` is a no-op.
 */
export function patchGlobalFetch(
  resolveRecordingId: () => Promise<string | null>,
): void {
  const original = globalThis.fetch as PatchableFetch | undefined;
  if (typeof original !== 'function' || original.__testProxyRecorderPatched) {
    return;
  }

  const patched: PatchableFetch = async (input, init) => {
    let recordingId: string | null = null;
    try {
      recordingId = await resolveRecordingId();
    } catch {
      // Never let recorder bookkeeping surface as a failure of the app's fetch.
      recordingId = null;
    }
    if (!recordingId) {
      return original(input, init);
    }

    let tagged: RequestInit;
    try {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      // Don't clobber an id a caller set explicitly.
      if (!headers.has(RECORDING_ID_HEADER)) {
        headers.set(RECORDING_ID_HEADER, recordingId);
      }
      tagged = { ...init, headers };
    } catch {
      // Building/merging headers failed (e.g. an exotic caller value) — send the
      // request untouched rather than breaking it.
      return original(input, init);
    }
    return original(input, tagged);
  };

  patched.__testProxyRecorderPatched = true;
  globalThis.fetch = patched;
}
