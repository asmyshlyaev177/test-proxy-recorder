import http from 'node:http';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

import httpProxy from 'http-proxy';

import type { Recording } from './types.js';
import { addCorsHeaders, getCorsHeaders } from './utils/cors.js';

// Transparent and record mode share these so both reach the upstream alike: Host names the
// target (it is also the TLS server name), and certificates go unchecked as test targets are often self-signed.
export const UPSTREAM_PROXY_OPTIONS = {
  secure: false,
  changeOrigin: true,
} as const satisfies httpProxy.ServerOptions;

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
 * Buffer the proxied response, send it to the client, and resolve with the complete Recording.
 */
function handleProxyResponse(
  proxyRes: http.IncomingMessage,
  context: ProxyResponseContext,
): void {
  const { req, res, onProxyError } = context.options;

  addCorsHeaders(proxyRes, req);

  const responseChunks: Buffer[] = [];
  proxyRes.on('data', (chunk: Buffer) => {
    responseChunks.push(chunk);
  });

  proxyRes.on('end', () => {
    void completeRecording(proxyRes, Buffer.concat(responseChunks), context);
  });

  proxyRes.on('error', (err) => {
    console.error('Proxy response error:', err);
    if (!res.headersSent) {
      onProxyError(err, req, res);
    }
    context.resolve(null);
  });
}

function buildRecording(
  { req, key, recordingId, sequence }: RecordAndProxyOptions,
  requestBody: string,
  response: Recording['response'],
): Recording {
  return {
    request: {
      method: req.method!,
      url: req.url!,
      headers: req.headers,
      body: requestBody || null,
    },
    response,
    timestamp: new Date().toISOString(),
    key,
    recordingId,
    sequence,
  };
}

async function completeRecording(
  proxyRes: http.IncomingMessage,
  wireBody: Buffer,
  { options, requestBody, resolve }: ProxyResponseContext,
): Promise<void> {
  const { req, res, recordingId, sequence, onProxyError } = options;
  try {
    // The recording holds text, so a compressed body is decoded here and its encoding headers
    // dropped; replayed as-is, gzip bytes read back through utf8 are no longer valid gzip.
    const { body, decoded } = await decodeBody(
      wireBody,
      proxyRes.headers['content-encoding'],
    );
    const storedHeaders = withoutEncodingHeaders(proxyRes.headers, decoded);

    res.writeHead(proxyRes.statusCode || 200, {
      ...storedHeaders,
      ...(decoded ? { 'content-length': String(body.length) } : {}),
      ...getCorsHeaders(req),
    });
    res.end(body);

    console.log(
      `Recorded: ${req.method} ${req.url} (recordingId: ${recordingId}, sequence: ${sequence})`,
    );
    resolve(
      buildRecording(options, requestBody, {
        statusCode: proxyRes.statusCode!,
        headers: storedHeaders,
        body: body.toString('utf8') || null,
      }),
    );
  } catch (error) {
    console.error('Error completing recording:', error);
    if (!res.headersSent) {
      onProxyError(error as Error, req, res);
    }
    resolve(null);
  }
}

/**
 * Proxy the buffered request through http-proxy, as transparent mode does, and capture the response.
 */
function proxyWithBufferedBody(
  options: RecordAndProxyOptions,
  requestBody: Buffer,
): Promise<Recording | null> {
  const { req, res, target, onProxyError } = options;
  // One proxy per request, so the 'proxyRes' it emits can only belong to this request.
  const proxy = httpProxy.createProxyServer({
    ...UPSTREAM_PROXY_OPTIONS,
    selfHandleResponse: true,
  });

  return new Promise<Recording | null>((resolve) => {
    proxy.once('proxyRes', (proxyRes) => {
      handleProxyResponse(proxyRes, {
        options,
        requestBody: requestBody.toString('utf8'),
        resolve,
      });
    });

    proxy.web(
      req,
      res,
      {
        target,
        // The request stream was drained while buffering; an empty chunk would switch a bodiless POST to chunked.
        buffer: Readable.from(requestBody.length > 0 ? [requestBody] : []),
        // Identity asks the upstream for a plain body; what still arrives compressed is decoded.
        headers: { 'accept-encoding': 'identity' },
      },
      (err) => {
        // Network errors only (ECONNREFUSED, TLS); HTTP error statuses arrive as a response.
        onProxyError(err, req, res);
        resolve(null);
      },
    );
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
    return await proxyWithBufferedBody(options, Buffer.concat(chunks));
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

// The decoded body is held whole in memory; past this it is relayed and stored as it arrived.
export const MAX_DECODED_BYTES = 100 * 1024 * 1024;
const DECODE_LIMITS = { maxOutputLength: MAX_DECODED_BYTES };

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);
const brotliDecompress = promisify(zlib.brotliDecompress);

const DECODERS: Record<string, (body: Buffer) => Promise<Buffer>> = {
  gzip: (body) => gunzip(body, DECODE_LIMITS),
  'x-gzip': (body) => gunzip(body, DECODE_LIMITS),
  // Some servers send deflate without the zlib header; browsers accept both forms.
  deflate: (body) =>
    inflate(body, DECODE_LIMITS).catch(() => inflateRaw(body, DECODE_LIMITS)),
  br: (body) => brotliDecompress(body, DECODE_LIMITS),
};

async function decodeBody(
  body: Buffer,
  encoding: string | undefined,
): Promise<{ body: Buffer; decoded: boolean }> {
  const decoder = DECODERS[(encoding ?? '').trim().toLowerCase()];
  if (!decoder || body.length === 0) return { body, decoded: false };
  try {
    return { body: await decoder(body), decoded: true };
  } catch (error) {
    // The client still gets the bytes as sent, as transparent mode would relay them.
    console.warn(
      `Could not decode ${encoding} response body, recording it as received:`,
      error,
    );
    return { body, decoded: false };
  }
}

/** A stored body is complete, so chunking goes; a decoded one also drops the headers of its wire form. */
function withoutEncodingHeaders(
  headers: http.IncomingHttpHeaders,
  decoded: boolean,
): http.IncomingHttpHeaders {
  const kept = { ...headers };
  delete kept['transfer-encoding'];
  if (decoded) {
    delete kept['content-encoding'];
    delete kept['content-length'];
  }
  return kept;
}
