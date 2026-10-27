# Recording on several workers

After test-proxy-recorder 2.0.1 one proxy records for any number of workers: each request is filed under the session named in its `x-test-rcrd-id` header (or the `proxy-recording-id` cookie on a browser WebSocket handshake), a test's cleanup saves its own session only, and a switch starts a session without ending another. Versions up to 2.0.1 held one record session for every request, so a record run there is `--workers 1`.

What a parallel record run still needs is an app whose tests do not share state. Tests that reset one database in `beforeEach` or sign in to one account overwrite each other whatever the proxy does. One app server per worker, each on its own port and data directory, keeps them apart; the proxy can stay one for all of them, or be one per worker as below (what PostingFit ran on 2.0.1: 11 tests of 2-8 minutes of upstream calls each recorded in 11.5 minutes on five pairs against 49 on one worker).

## Config

One list of pairs, each on its own ports and data directory. Everything below derives from it. With one shared proxy, drop `proxyPort` from the pair, point every app server at the one proxy and leave `TEST_PROXY_RECORDER_PORT` alone.

```ts
// e2e/servers.ts
import { test } from '@playwright/test';

export const WORKERS = 5;

export const serverOf = (index: number) => ({
  port: 3100 + index,
  proxyPort: 8100 + index,
  dataDir: `test-results/data/${index}`,
});

export const SERVERS = Array.from({ length: WORKERS }, (_, index) => serverOf(index));

// parallelIndex, not workerIndex: workerIndex keeps counting when Playwright
// replaces a worker after a failure, and would run past the pairs.
export const currentServer = () => serverOf(test.info().parallelIndex);
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { SERVERS, WORKERS } from './e2e/servers';

const isRecord = !!process.env.RECORD_MODE;

const proxyServer = ({ proxyPort }: (typeof SERVERS)[number]) => ({
  command: `test-proxy-recorder http://localhost:4000 --port ${proxyPort} --dir e2e/recordings`,
  url: `http://localhost:${proxyPort}/__control`,
  reuseExistingServer: true,
});

const appServer = ({ port, proxyPort, dataDir }: (typeof SERVERS)[number]) => ({
  command: 'node server/index.ts',
  url: `http://localhost:${port}`,
  env: {
    PORT: String(port),
    DATA_DIR: `./${dataDir}`,
    API_BASE_URL: `http://localhost:${proxyPort}`,
    ...(isRecord ? { API_KEY: process.env.API_KEY ?? '' } : {}),
  },
});

export default defineConfig({
  testDir: './e2e',
  workers: WORKERS,
  globalTeardown: './e2e/global-teardown.ts',
  // No baseURL here: the worker fixture below sets it per pair.
  webServer: SERVERS.flatMap((server) => [proxyServer(server), appServer(server)]),
});
```

All pairs share one recordings directory; session ids are per test, so the files never collide. Build the app once, in the script, not in each pair's command: N commands starting at once would each run the build.

```json
{
  "e2e": "pnpm build && playwright test",
  "e2e:record": "RECORD_MODE=1 pnpm e2e"
}
```

## Fixtures

A worker-scoped fixture picks the worker's pair and sets `TEST_PROXY_RECORDER_PORT`, which the helpers read on every call, so each `playwrightProxy.before()` in that worker reaches its own proxy. A `baseURL` fixture that depends on it points the page at the worker's app.

```ts
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';
import { serverOf } from './servers';

type Server = ReturnType<typeof serverOf>;
const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// Specs with no proxied call use this one: the record run fails a test that has no recording.
export const plainTest = base.extend<Record<never, never>, { server: Server }>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const server = serverOf(workerInfo.parallelIndex);
      process.env.TEST_PROXY_RECORDER_PORT = String(server.proxyPort);
      await use(server);
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ server }, use) => use(`http://localhost:${server.port}`),
});

export const test = plainTest.extend({
  page: async ({ page }, use, testInfo) => {
    await playwrightProxy.before(page, testInfo, mode);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

Helpers that read an app server's files (an email outbox, a SQLite file, a staged webhook) derive the path from `currentServer().dataDir` instead of one constant.

```ts
// e2e/global-teardown.ts
import { playwrightProxy } from 'test-proxy-recorder';
import { SERVERS } from './servers';

export default async function globalTeardown() {
  for (const { proxyPort } of SERVERS) {
    process.env.TEST_PROXY_RECORDER_PORT = String(proxyPort);
    await playwrightProxy.teardown();
  }
}
```

Record mode then runs with the normal worker count: `RECORD_MODE=1 pnpm e2e`, no `--workers 1`.

## Pitfalls

- Every spec imports `test` from the fixtures file. A spec on the base `test` from `@playwright/test` has no `baseURL` once the config stops setting one ("Cannot navigate to invalid URL").
- `reuseExistingServer` reuses an app server from an earlier run with that run's env. A replay run's server has no API key, so a record run after it must start its own; Playwright kills the servers it started, so this bites only with hand-started servers.
- `stdout: 'pipe'` on the app server entries puts the servers' warnings into Playwright's output, which is where a stalled call shows up.
- On 2.0.1 a record run on several pairs could stall one test on one pair: the ending test's session cleanup overlapped the next test's switch and cleared its session, and every call of the next test hung until the client gave up. After 2.0.1 sessions are per request and a cleanup touches only its own; on 2.0.1, record the stalled test again on its own.
