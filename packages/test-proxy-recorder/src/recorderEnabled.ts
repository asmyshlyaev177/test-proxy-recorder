/**
 * Check if the test proxy recorder is enabled based on environment variables.
 * Automatically enabled in non-production environments; can be explicitly
 * enabled in production with `TEST_PROXY_RECORDER_ENABLED`.
 *
 * Shared by every framework adapter (Next.js, TanStack Start) so they all gate
 * their `fetch`/header patching the same way.
 *
 * @returns true if the recorder should be active, false otherwise
 */
export function isRecorderEnabled(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const isExplicitlyEnabled =
    process.env.TEST_PROXY_RECORDER_ENABLED === 'true' ||
    Number.parseInt(process.env.TEST_PROXY_RECORDER_ENABLED || '') === 1;

  return !isProduction || isExplicitlyEnabled;
}
