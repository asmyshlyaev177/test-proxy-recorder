// Standalone redaction guard, run after the record pass (see package.json).
//
// The secret page/route deliberately expose secrets in request headers, a
// response Set-Cookie, and the response body. After recording, none of those
// values may survive in any recording file — neither the proxy-written
// `.mock.json` nor the Playwright-written, teardown-redacted `.har`. This script
// scans the recordings and fails the run if any secret leaks.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RECORDINGS_DIR = path.join(process.cwd(), 'e2e', 'recordings');

// The literal secrets used by app/secret/page.tsx and mock-backend/server.mjs.
const FORBIDDEN = [
  'super-secret-har-jwt', // Authorization token (request header)
  'har-key-secret', // x-api-key (request header)
  'top-secret-session-value', // Set-Cookie (response header)
  'sk_live_HARSECRET123', // token in the response body
];

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};

const files = (await readdir(RECORDINGS_DIR)).filter(
  (f) => f.endsWith('.har') || f.endsWith('.mock.json'),
);

for (const file of files) {
  const raw = await readFile(path.join(RECORDINGS_DIR, file), 'utf8');
  const leaks = FORBIDDEN.filter((secret) => raw.includes(secret));
  if (leaks.length > 0) {
    fail(`${file} leaks: ${leaks.join(', ')}`);
  }
}

// Guard against a false pass where the recording simply wasn't produced: the
// secret HAR must exist and show evidence the recorder scrubbed it.
const secretHar = files.find(
  (f) => f.startsWith('secret__') && f.endsWith('.har'),
);
if (!secretHar) {
  fail('no secret__*.har recording found — did the secret test run in record mode?');
} else {
  const raw = await readFile(path.join(RECORDINGS_DIR, secretHar), 'utf8');
  if (!raw.includes('[REDACTED]')) {
    fail(`${secretHar} has no [REDACTED] markers — HAR redaction did not run`);
  }
}

if (failed) {
  console.error('\nRedaction check FAILED.\n');
  process.exit(1);
}

console.log(
  `Redaction check passed — scanned ${files.length} recording file(s), no secrets found.`,
);
