import http from 'node:http';

import { RECORDING_ID_HEADER } from '../constants.js';

/**
 * Get CORS headers for a given request
 * @param req The incoming HTTP request
 * @returns An object containing CORS headers
 */
export function getCorsHeaders(
  req: http.IncomingMessage,
): Record<string, string> {
  const origin = req.headers.origin;

  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers':
      req.headers['access-control-request-headers'] ||
      `Origin, X-Requested-With, Content-Type, Accept, Authorization, ${RECORDING_ID_HEADER}`,
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'access-control-expose-headers': '*',
  };
}

/**
 * Merge CORS headers into a proxied response (used as http-proxy 'proxyRes' handler)
 */
export function addCorsHeaders(
  proxyRes: http.IncomingMessage,
  req: http.IncomingMessage,
): void {
  Object.assign(proxyRes.headers, getCorsHeaders(req));
}
