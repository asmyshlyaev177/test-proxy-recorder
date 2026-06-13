import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

const PROXY_URL = 'http://localhost:8100';
const SESSION_ID = 'redaction__strips-secrets';
const RECORDING_PATH = path.join(
  process.cwd(),
  'e2e',
  'recordings',
  `${SESSION_ID}.mock.json`,
);

const SECRET_TOKEN = 'super-secret-jwt-value';
const SECRET_COOKIE = 'refresh=top-secret-refresh-token';

// Secrets must never be committed to a recording. This test records a request
// carrying Authorization/Cookie headers through the proxy and asserts the saved
// .mock.json has them redacted. It drives record mode itself, so it verifies the
// real write path regardless of whether the suite runs in record or replay mode.
test('redacts secrets from saved recordings', async () => {
  await fs.rm(RECORDING_PATH, { force: true });

  await setProxyMode('record', SESSION_ID);
  try {
    const response = await fetch(`${PROXY_URL}/todos`, {
      headers: {
        'x-test-rcrd-id': SESSION_ID,
        authorization: `Bearer ${SECRET_TOKEN}`,
        cookie: SECRET_COOKIE,
      },
    });
    expect(response.ok).toBe(true);
    await response.text();
  } finally {
    // Switching away from record mode flushes and saves the session.
    await setProxyMode('transparent', SESSION_ID);
  }

  const raw = await fs.readFile(RECORDING_PATH, 'utf8');

  // No raw secret leaks anywhere in the file.
  expect(raw).not.toContain(SECRET_TOKEN);
  expect(raw).not.toContain('top-secret-refresh-token');

  const recording = JSON.parse(raw);
  const requestHeaders = recording.recordings[0].request.headers;
  expect(requestHeaders.authorization).toBe('[REDACTED]');
  expect(requestHeaders.cookie).toBe('[REDACTED]');
  // Non-sensitive headers survive.
  expect(requestHeaders['x-test-rcrd-id']).toBe(SESSION_ID);

  // Keep the repo clean — this is a generated artifact, not a fixture.
  await fs.rm(RECORDING_PATH, { force: true });
});
