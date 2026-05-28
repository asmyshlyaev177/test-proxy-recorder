import http from 'node:http';

const CONTENT_TYPE_JSON = 'application/json';

export async function readRequestBody(
  req: http.IncomingMessage,
): Promise<string> {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  return body;
}

export function sendJsonResponse(
  res: http.ServerResponse,
  statusCode: number,
  data: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { 'Content-Type': CONTENT_TYPE_JSON });
  res.end(JSON.stringify(data));
}
