import crypto from 'node:crypto';
import http from 'node:http';

import filenamify from 'filenamify';

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
