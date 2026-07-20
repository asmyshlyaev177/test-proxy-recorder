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

// The literal secrets used by src/lib/api.ts (fetchSecret) and mock-backend/server.mjs.
const FORBIDDEN = [
  'super-secret-har-jwt', // Authorization token (request header)
  'har-key-secret', // x-api-key (request header)
  'top-secret-session-value', // Set-Cookie (response header)
  'sk_live_HARSECRET123', // token in the response body
];

// The Cognito access token (auth.spec.ts) is dynamic — a fresh JWT per login — so
// instead of a fixed string we assert that NO JWT survives in any recording. A
// Cognito token is three base64url segments; a leak means Authorization redaction failed.
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/;
// The Cognito login must run in transparent mode and never produce a recording.
const FORBIDDEN_PREFIXES = ['setup-auth', 'authenticate'];
// Only require the authenticated recording when the Cognito suite actually ran
// (creds present). Without creds the `auth` project is skipped — see playwright.config.ts.
const authExpected = !!(
  process.env.COGNITO_TEST_EMAIL && process.env.COGNITO_TEST_PASSWORD
);

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
  const jwt = raw.match(JWT_RE);
  if (jwt) fail(`${file} leaks a JWT: ${jwt[0].slice(0, 16)}…`);
}

for (const prefix of FORBIDDEN_PREFIXES) {
  const leaked = files.find((f) => f.startsWith(prefix));
  if (leaked) {
    fail(
      `${leaked} should not exist — the Cognito login must run in transparent mode and never be recorded`,
    );
  }
}

if (authExpected) {
  const authHar = files.find(
    (f) => f.startsWith('auth__') && f.endsWith('.har'),
  );
  if (!authHar) {
    fail('no auth__*.har found — did the authenticated test run in record mode?');
  } else {
    const raw = await readFile(path.join(RECORDINGS_DIR, authHar), 'utf8');
    if (!raw.includes('[REDACTED]')) {
      fail(`${authHar} has no [REDACTED] markers — HAR redaction did not run`);
    }
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
