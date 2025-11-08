import http from 'node:http';

const QUERY_HASH_LENGTH = 8;

export function generateRequestKey(req: http.IncomingMessage): string {
  const urlParts = req.url!.split('?');
  const pathname = urlParts[0];
  const query = urlParts[1] || '';

  const normalizedPath = normalizePathname(pathname);
  const queryHash = generateQueryHash(query);

  return `${req.method}_${normalizedPath}${queryHash}.json`;
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replaceAll('/', '_').replace(/^_/, '');
  return normalized || 'root';
}

function generateQueryHash(query: string): string {
  if (!query) {
    return '';
  }

  const hash = Buffer.from(query)
    .toString('base64')
    .replaceAll(/[^a-zA-Z0-9]/g, '')
    .slice(0, Math.max(0, QUERY_HASH_LENGTH));

  return `_${hash}`;
}
