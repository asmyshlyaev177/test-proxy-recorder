/**
 * TanStack Start-specific exports that don't pull in the rest of the library.
 * Use this import path in a TanStack Start app:
 * import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start'
 */

export { RECORDING_ID_HEADER } from './constants.js';
export { registerProxyFetch } from './tanstack-start/registerProxyFetch.js';
export {
  createHeadersWithRecordingId,
  getRecordingId,
} from './tanstack-start/requestContext.js';
