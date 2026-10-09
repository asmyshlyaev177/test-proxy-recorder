import http from 'node:http';

import { RECORDING_ID_HEADER } from '../constants.js';

/**
 * Extract recording ID from custom HTTP header
 * Used for concurrent replay session routing, especially with Next.js
 */
function getRecordingIdFromHeader(req: http.IncomingMessage): string | null {
  const headerValue = req.headers[RECORDING_ID_HEADER];
  if (!headerValue) {
    return null;
  }
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return value === undefined ? null : decodeUtf8Header(value);
}

/**
 * Browsers send header values as UTF-8 and Node reads them as latin1, so a
 * non-ASCII id (a describe title such as 'Корзина') arrives garbled; read its
 * bytes back as UTF-8. A value that isn't valid UTF-8 is kept as it is.
 */
function decodeUtf8Header(value: string): string {
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}

/**
 * Extract recording ID from request cookie
 * Used for concurrent replay session routing (fallback method)
 */
function getRecordingIdFromCookie(req: http.IncomingMessage): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) {
    return null;
  }

  const match = cookies.match(/proxy-recording-id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extract recording ID from request using custom header (preferred) or cookie (fallback)
 * @param req The incoming HTTP request
 * @returns The recording ID, or null if not found
 */
export function getRecordingIdFromRequest(
  req: http.IncomingMessage,
): string | null {
  // Prefer custom header over cookie for Next.js compatibility
  const fromHeader = getRecordingIdFromHeader(req);
  const fromCookie = getRecordingIdFromCookie(req);

  return fromHeader ?? fromCookie ?? null;
}
