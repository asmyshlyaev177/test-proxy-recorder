// Redaction guard, run after the record pass (see package.json). It asserts:
//  - the fixed mock access token never leaks into any recording,
//  - no login/setup recording exists (login ran in transparent mode),
//  - the dashboard recording exists and shows `[REDACTED]` markers (proves the
//    Authorization header + session cookie were scrubbed).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Single source of truth for the token lives with the backend that issues it.
import { MOCK_ACCESS_TOKEN } from 'example-auth-shared/mock-backend';

const RECORDINGS_DIR = path.join(process.cwd(), 'e2e', 'recordings');
const FORBIDDEN = [MOCK_ACCESS_TOKEN];
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
  const leaks = FORBIDDEN.filter((secret) => raw.includes(secret));
  if (leaks.length > 0) fail(`${file} leaks: ${leaks.join(', ')}`);
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
  `Redaction check passed — scanned ${files.length} recording file(s), no secrets found.`,
);
