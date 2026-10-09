/**
 * The `test-proxy-recorder/nextjs` entry: Next.js helpers without the proxy's
 * server-side dependencies, which webpack can't bundle.
 */

export { RECORDING_ID_HEADER } from '../constants.js';
export type { NextJSRequest, NextJSResponse } from './middleware.js';
export {
  createHeadersWithRecordingId,
  getRecordingId,
  setNextProxyHeaders,
} from './middleware.js';
export {
  type ProxyAxiosInstance,
  type ProxyAxiosRequestConfig,
  registerProxyAxios,
} from './registerProxyAxios.js';
export { registerProxyFetch } from './registerProxyFetch.js';
