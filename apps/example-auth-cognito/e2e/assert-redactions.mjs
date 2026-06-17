// Redaction guard, run after the record pass (see package.json). The Cognito
// access token is dynamic (a fresh JWT per login), so instead of a fixed string
// we assert that NO JWT survives in any recording. It also checks that the login
// produced no recording and that the dashboard recording shows `[REDACTED]`.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RECORDINGS_DIR = path.join(process.cwd(), 'e2e', 'recordings');

// A Cognito access/id token is a JWT: three base64url segments. If one survives
// in a recording, the Authorization redaction failed.
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/;
// Login must run in transparent mode and never produce a recording.
const FORBIDDEN_PREFIXES = ['setup-auth', 'login', 'authenticate'];
const REQUIRED_HAR_PREFIX = 'dashboard__';

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};

let files = [];
try {
  files = (await readdir(RECORDINGS_DIR)).filter(
    (f) => f.endsWith('.har') || f.endsWith('.mock.json'),
  );
} catch {
  fail(`recordings dir not found: ${RECORDINGS_DIR}`);
}

for (const file of files) {
  const raw = await readFile(path.join(RECORDINGS_DIR, file), 'utf8');
  const match = raw.match(JWT_RE);
  if (match) fail(`${file} leaks a JWT: ${match[0].slice(0, 16)}…`);
}

for (const prefix of FORBIDDEN_PREFIXES) {
  const leaked = files.find((f) => f.startsWith(prefix));
  if (leaked) {
    fail(
      `${leaked} should not exist — the login flow must run in transparent mode and never be recorded`,
    );
  }
}

const har = files.find(
  (f) => f.startsWith(REQUIRED_HAR_PREFIX) && f.endsWith('.har'),
);
if (!har) {
  fail(
    `no ${REQUIRED_HAR_PREFIX}*.har found — did the authenticated test run in record mode?`,
  );
} else {
  const raw = await readFile(path.join(RECORDINGS_DIR, har), 'utf8');
  if (!raw.includes('[REDACTED]')) {
    fail(`${har} has no [REDACTED] markers — HAR redaction did not run`);
  }
}

if (failed) {
  console.error('\nRedaction check FAILED.\n');
  process.exit(1);
}

console.log(
  `Redaction check passed — scanned ${files.length} recording file(s), no JWT leaked.`,
);
