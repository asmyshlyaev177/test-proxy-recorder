/**
 * Next.js-specific exports that don't include server-side dependencies
 * Use this import path in Next.js to avoid webpack bundling issues:
 * import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs'
 */

export { RECORDING_ID_HEADER } from './constants.js';
export type { NextJSRequest, NextJSResponse } from './nextjs/middleware.js';
export {
  createHeadersWithRecordingId,
  getRecordingId,
  setNextProxyHeaders,
} from './nextjs/middleware.js';
