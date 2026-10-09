/**
 * The `test-proxy-recorder/tanstack-start` entry: TanStack Start helpers without
 * the rest of the library.
 */

export { RECORDING_ID_HEADER } from '../constants.js';
export { registerProxyFetch } from './registerProxyFetch.js';
export {
  createHeadersWithRecordingId,
  getRecordingId,
} from './requestContext.js';
