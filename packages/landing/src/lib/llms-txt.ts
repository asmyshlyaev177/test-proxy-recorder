import RAW from '../llms.txt.md?raw';

/**
 * The /llms.txt document, with `{{LAST_UPDATED}}` resolved to the date the
 * content last changed (HEAD commit — see scripts/build-date.mjs).
 *
 * Shared by the /llms.txt route and by the homepage's `Accept: text/markdown`
 * branch in src/middleware.ts, so the two can't drift.
 */
export const LLMS_TXT = RAW.replaceAll(
  '{{LAST_UPDATED}}',
  __CONTENT_LAST_MODIFIED__.slice(0, 10),
);
