import { RECORDING_ID_HEADER } from '../constants.js';

/**
 * Minimal type for Next.js Request - compatible with next/server's NextRequest
 * We define this locally to avoid requiring Next.js as a dependency
 */
export interface NextJSRequest {
  headers: Headers;
}

/**
 * Minimal type for Next.js Response - compatible with next/server's NextResponse
 * We define this locally to avoid requiring Next.js as a dependency
 */
export interface NextJSResponse {
  headers: Headers;
}

/**
 * Check if the test proxy recorder is enabled based on environment variables
 * Automatically enabled in non-production environments
 * Can be explicitly enabled in production with TEST_PROXY_RECORDER_ENABLED
 *
 * @returns true if the recorder should be active, false otherwise
 */
function isRecorderEnabled(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const isExplicitlyEnabled =
    process.env.TEST_PROXY_RECORDER_ENABLED === 'true' ||
    Number.parseInt(process.env.TEST_PROXY_RECORDER_ENABLED || '') === 1;

  return !isProduction || isExplicitlyEnabled;
}

/**
 * Next.js middleware helper for forwarding test proxy recording headers
 * Automatically forwards the recording ID header from incoming requests to the proxy
 * Only runs in non-production environments or when TEST_PROXY_RECORDER_ENABLED is set
 *
 * @example
 * // middleware.ts
 * import { NextResponse } from 'next/server';
 * import type { NextRequest } from 'next/server';
 * import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';
 *
 * export function middleware(request: NextRequest) {
 *   const response = NextResponse.next();
 *   // Only forwards headers in test/dev environments
 *   setNextProxyHeaders(request, response);
 *   return response;
 * }
 *
 * @param request - Next.js request object (NextRequest from next/server)
 * @param response - Next.js response object (NextResponse from next/server)
 */
export function setNextProxyHeaders(
  request: NextJSRequest,
  response: NextJSResponse,
): void {
  // Skip in production unless explicitly enabled
  if (!isRecorderEnabled()) {
    return;
  }

  const recordingId = request.headers.get(RECORDING_ID_HEADER);
  if (recordingId) {
    // Forward the recording ID header to downstream requests
    response.headers.set(RECORDING_ID_HEADER, recordingId);
  }
}

/**
 * Get the recording ID from the request if present
 * Useful for manually adding the header to fetch requests in Next.js
 *
 * @example
 * // In your API route or server component
 * import { getRecordingId } from 'test-proxy-recorder/nextjs';
 * import { headers } from 'next/headers';
 *
 * export async function GET() {
 *   const recordingId = getRecordingId(headers());
 *
 *   const response = await fetch('http://localhost:8100/api/data', {
 *     headers: {
 *       ...(recordingId && { 'x-test-rcrd-id': recordingId })
 *     }
 *   });
 *
 *   return Response.json(await response.json());
 * }
 *
 * @param requestHeaders - Next.js headers object or NextRequest from next/server
 * @returns The recording ID if present, null otherwise
 */
export function getRecordingId(
  requestHeaders: NextJSRequest | Headers,
): string | null {
  if (requestHeaders instanceof Headers) {
    // It's a Headers object
    return requestHeaders.get(RECORDING_ID_HEADER);
  }
  // It's a NextJSRequest
  return requestHeaders.headers.get(RECORDING_ID_HEADER);
}

/**
 * Create headers object with recording ID for fetch requests
 * Use this helper when making fetch requests in Next.js to forward the recording ID
 *
 * @example
 * // In your API route or server component
 * import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';
 * import { headers } from 'next/headers';
 *
 * export async function GET() {
 *   const response = await fetch('http://localhost:8100/api/data', {
 *     headers: createHeadersWithRecordingId(headers(), {
 *       'Content-Type': 'application/json',
 *     })
 *   });
 *
 *   return Response.json(await response.json());
 * }
 *
 * @param requestHeaders - Next.js headers object or NextRequest from next/server
 * @param additionalHeaders - Optional additional headers to include
 * @returns Headers object with recording ID if present
 */
export function createHeadersWithRecordingId(
  requestHeaders: NextJSRequest | Headers,
  additionalHeaders: Record<string, string> = {},
): Record<string, string> {
  // Skip adding recording ID in production unless explicitly enabled
  if (!isRecorderEnabled()) {
    return additionalHeaders;
  }

  const recordingId = getRecordingId(requestHeaders);
  return {
    ...additionalHeaders,
    ...(recordingId && { [RECORDING_ID_HEADER]: recordingId }),
  };
}
