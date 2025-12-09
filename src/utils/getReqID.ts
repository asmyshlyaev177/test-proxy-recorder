import crypto from 'node:crypto';
import http from 'node:http';

import filenamify from 'filenamify';

/**
 * Core logic for generating a recording key from pathname, query, and method
 * @param pathname The URL pathname
 * @param query The URL query string (without leading '?')
 * @param method The HTTP method
 * @returns A unique recording key
 */
function generateRecordingKey(
  pathname: string,
  query: string,
  method: string,
): string {
  // Handle root path and use filenamify to sanitize
  const pathPart = pathname === '/' ? 'root' : pathname.slice(1);
  const normalizedPath = filenamify(pathPart, { replacement: '_' });
  const queryHash = generateQueryHash(query);

  const filename = `${method}_${normalizedPath}${queryHash}.json`;
  return filenamify(filename, { replacement: '_' });
}

/**
 * Generate a recording key from an HTTP request
 * @param req The incoming HTTP request
 * @returns A unique recording key
 */
export function getReqID(req: http.IncomingMessage): string {
  const urlParts = req.url!.split('?');
  const pathname = urlParts[0];
  const query = urlParts[1] || '';

  return generateRecordingKey(pathname, query, req.method!);
}

/**
 * Generate a recording key from a full URL and HTTP method
 * Used for client-side recording where we have the full URL instead of just the path
 * @param url The full URL string
 * @param method The HTTP method
 * @returns A unique recording key
 */
export function getReqIDFromUrl(url: string, method: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const query = urlObj.search.slice(1); // Remove leading '?'

  return generateRecordingKey(pathname, query, method);
}

function generateQueryHash(query: string): string {
  if (!query) {
    return '';
  }

  // Use MD5 hash to ensure unique keys for different query parameters
  // This prevents collisions that could cause wrong responses to be replayed
  // eslint-disable-next-line sonarjs/hashing
  const hash = crypto
    .createHash('md5')
    .update(query)
    .digest('hex')
    .slice(0, 16); // Use 16 characters for reasonable uniqueness while keeping filenames manageable

  return `_${hash}`;
}
