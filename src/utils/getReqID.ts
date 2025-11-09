import http from 'node:http';

import filenamify from 'filenamify';

const QUERY_HASH_LENGTH = 8;

export function getReqID(req: http.IncomingMessage): string {
  const urlParts = req.url!.split('?');
  const pathname = urlParts[0];
  const query = urlParts[1] || '';

  // Handle root path and use filenamify to sanitize
  const pathPart = pathname === '/' ? 'root' : pathname.slice(1);
  const normalizedPath = filenamify(pathPart, { replacement: '_' });
  const queryHash = generateQueryHash(query);

  const filename = `${req.method}_${normalizedPath}${queryHash}.json`;
  return filenamify(filename, { replacement: '_' });
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
