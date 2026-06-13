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
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
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
