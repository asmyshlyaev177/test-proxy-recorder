import http from 'node:http';
import https from 'node:https';

import type { Recording } from './types.js';
import { addCorsHeaders, getCorsHeaders } from './utils/cors.js';

interface RecordAndProxyOptions {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  target: string;
  key: string;
  recordingId: number;
  sequence: number;
  onProxyError: (
    err: Error,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void;
}

/**
 * Buffer the full request body. Resolves with the collected chunks even when
 * buffering fails (logged), so the proxy request can still be attempted.
 */
async function bufferRequestBody(req: http.IncomingMessage): Promise<Buffer[]> {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  try {
    await new Promise<void>((resolveBuffer, rejectBuffer) => {
      req.on('end', () => resolveBuffer());
      req.on('error', (err) => rejectBuffer(err));
      // Add timeout to prevent hanging
      setTimeout(
        () => rejectBuffer(new Error('Request buffering timeout')),
        30_000,
      );
    });
  } catch (error) {
    console.error('Error buffering request:', error);
  }

  return chunks;
}

interface ProxyResponseContext {
  options: RecordAndProxyOptions;
  requestBody: string;
  resolve: (recording: Recording | null) => void;
}

/**
 * Buffer the proxied response, send it to the client, and resolve with the
 * complete Recording.
 */
function handleProxyResponse(
  proxyRes: http.IncomingMessage,
  context: ProxyResponseContext,
): void {
  const { options, requestBody, resolve } = context;
  const { req, res, key, recordingId, sequence, onProxyError } = options;

  // Add CORS headers
  addCorsHeaders(proxyRes, req);

  // Buffer response data for recording
  const responseChunks: Buffer[] = [];

  proxyRes.on('data', (chunk: Buffer) => {
    responseChunks.push(chunk);
  });

  proxyRes.on('end', () => {
    try {
      const responseBody = Buffer.concat(responseChunks);
      const responseBodyStr = responseBody.toString('utf8');

      // Create the complete recording
      const recording: Recording = {
        request: {
          method: req.method!,
          url: req.url!,
          headers: req.headers,
          body: requestBody || null,
        },
        response: {
          statusCode: proxyRes.statusCode!,
          headers: proxyRes.headers,
          body: responseBodyStr || null,
        },
        timestamp: new Date().toISOString(),
        key,
        recordingId,
        sequence,
      };

      const responseHeaders = {
        ...proxyRes.headers,
        ...getCorsHeaders(req),
      };

      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      res.end(responseBody);

      console.log(
        `Recorded: ${req.method} ${req.url} (recordingId: ${recordingId}, sequence: ${sequence})`,
      );

      // Resolve with the complete recording
      resolve(recording);
    } catch (error) {
      console.error('Error completing recording:', error);
      resolve(null);
    }
  });

  proxyRes.on('error', (err) => {
    console.error('Proxy response error:', err);
    if (!res.headersSent) {
      onProxyError(err, req, res);
    }
    resolve(null);
  });
}

/**
 * Proxy the buffered request to the target and capture the response.
 */
function proxyWithBufferedBody(
  options: RecordAndProxyOptions,
  chunks: Buffer[],
): Promise<Recording | null> {
  const { req, res, target, onProxyError } = options;
  const requestBody = Buffer.concat(chunks).toString('utf8');

  // Determine if we need http or https
  const targetUrl = new URL(target);
  const isHttps = targetUrl.protocol === 'https:';
  const requestModule = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;

  return new Promise<Recording | null>((resolve) => {
    // Create a new request to proxy with the buffered body
    const proxyReq = requestModule.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port || defaultPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        handleProxyResponse(proxyRes, { options, requestBody, resolve });
      },
    );

    proxyReq.on('error', (err) => {
      // This handles network/connection errors (e.g., ECONNREFUSED, ETIMEDOUT)
      // NOT HTTP error responses (which are handled above in the response callback)
      onProxyError(err, req, res);
      resolve(null);
    });

    // Write the buffered body to the proxy request
    if (chunks.length > 0) {
      proxyReq.write(Buffer.concat(chunks));
    }

    proxyReq.end();
  });
}

/**
 * Record-mode HTTP handler: buffers the request, proxies it to the target,
 * buffers the response, and resolves with the complete Recording (or null on
 * failure). The returned promise must be collected by the caller so request
 * order is preserved.
 *
 * Note: streaming requests are buffered before proxying; streaming
 * passthrough is not yet implemented.
 */
export async function recordAndProxyRequest(
  options: RecordAndProxyOptions,
): Promise<Recording | null> {
  const { req, res, onProxyError } = options;

  try {
    const chunks = await bufferRequestBody(req);
    return await proxyWithBufferedBody(options, chunks);
  } catch (error) {
    console.error('Error in recordAndProxyRequest:', error);
    try {
      onProxyError(error as Error, req, res);
    } catch (error_) {
      console.error('Failed to handle proxy error:', error_);
    }
    return null;
  }
}
