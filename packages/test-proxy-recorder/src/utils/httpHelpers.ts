import http from 'node:http';

const CONTENT_TYPE_JSON = 'application/json';

export async function readRequestBody(
  req: http.IncomingMessage,
): Promise<string> {
  // Decoded once whole: a multibyte character split between chunks breaks when each is decoded alone.
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Clients pick a fresh multipart boundary per request, so it cannot be part of a body's identity.
export function stripMultipartBoundary(
  body: string,
  contentType?: string,
): string {
  if (!contentType?.toLowerCase().includes('multipart/form-data')) return body;
  const boundary = /boundary="?([^";\s]+)/i.exec(contentType)?.[1];
  return boundary ? body.replaceAll(boundary, '') : body;
}

export function sendJsonResponse(
  res: http.ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { 'Content-Type': CONTENT_TYPE_JSON });
  res.end(JSON.stringify(data));
}
