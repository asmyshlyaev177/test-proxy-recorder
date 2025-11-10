# test-proxy-recorder

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)

HTTP proxy server for recording and replaying network requests in testing. Works seamlessly with Playwright and other testing frameworks.

## BETA VERSION

## Features

- **Fast CI/CD Tests**: Record API responses once with real backend, replay them on CI/CD
- **Fast workflow**: Record real interactions with API, instead of mocking every request manually
- **Server Side Rendering**: Can record SSR requests from JS frameworks like NextJS.
- **Deterministic Tests**: Same responses every time, no flaky network issues, no need to wire up the whole Backend API for testing

## Installation

```bash
npm install test-proxy-recorder
# or
pnpm add test-proxy-recorder
# or
yarn add test-proxy-recorder
```

## Quick Start

 1. Run proxy with your backend API as a target `test-proxy-recorder --port 8100 --target http://localhost:8000 --recordings ./recordings`, here your backend on port 8000 as target, proxy on port 8100.
 2. Point your Frontend app to proxy port, 8100 as example
 3. The proxy runs continuously in the background. Tests control the recording/replay mode using `playwrightProxy.before()` and `playwrightProxy.after()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('Test UI with API responses', async ({ page }, testInfo) => {
  // Set proxy to recording mode to record mocks, sanitized test title will be used as file name
  await playwrightProxy.before(testInfo, 'record');

  // Make requests - they will be recorded
  await page.goto('/myPage');
 /// ... test content ...

  // Save mock and return to transparent mode
  await playwrightProxy.after(testInfo);
});

// keep the name of test the same, it will be used as mock id
test('Test UI with API responses', async ({ page }, testInfo) => {
  // Set proxy to replay mode - uses recording from test above
  await playwrightProxy.before(testInfo, 'replay');

  await page.goto('/myPage');
 /// ... test content ...

  await playwrightProxy.after(testInfo);
});
```

## How It Works

The proxy server runs continuously and can switch between three modes:

### 1. Transparent Mode (Default)

Simply proxies requests to the backend without recording or replaying.

### 2. Record Mode

Captures all HTTP requests/responses and WebSocket messages to disk. Each test gets its own recording file based on the test name.

### 3. Replay Mode

Replays previously recorded responses from disk instead of hitting the real API. Perfect for fast, deterministic tests.

## Modes Control

### Via Playwright

```typescript
// Recording mode
await playwrightProxy.before(testInfo, 'recording');
// ... test code ...
await playwrightProxy.after(testInfo);

// Replay mode
await playwrightProxy.before(testInfo, 'replay');
// ... test code ...
await playwrightProxy.after(testInfo);
```

### Via HTTP Control Endpoint

Using curl:

```bash
# Switch to record mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-testfile-1", "timeout": 30000}'

# Switch to replay mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "replay", "id": "my-testfile-1"}'

# Switch to transparent mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "transparent", "id": "my-testfile-1"}'
```

Using JavaScript fetch:

```javascript
// Switch to record mode
await fetch('http://localhost:8100/__control', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'record',
    id: 'my-testfile-1',
    timeout: 30000
  })
});

// Switch to replay mode
await fetch('http://localhost:8100/__control', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'replay',
    id: 'my-testfile-1'
  })
});

// Switch to transparent mode
await fetch('http://localhost:8100/__control', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'transparent',
  })
});
```

## Usage

```bash
# Start proxy server
test-proxy-recorder --port 8100 --target http://localhost:8000 --recordings ./recordings
```

### CLI Options

- `--port, -p`: Port to listen on (default: 8080)
- `--target, -t`: Backend target URL (can add multiple targets)
- `--recordings, -r`: Directory to store recordings (default: ./recordings)

## API

### ProxyServer

```typescript
class ProxyServer {
  constructor(targets: string[], recordingsDir: string);

  async init(): Promise<void>;
  listen(port: number): http.Server;
}
```

### Control Endpoint

Send POST requests to `/__control` with JSON body:

```typescript
interface ControlRequest {
  mode: 'transparent' | 'record' | 'replay';
  id?: string;      // Will be used as file name for recordings, required for record/replay modes
  timeout?: number; // Auto-switch to transparent mode after timeout (ms), default 120 seconds
}
```

### Playwright Integration API

```typescript
import { playwrightProxy, setProxyMode } from 'test-proxy-recorder';

// Main helper object for use with Playwright tests
const playwrightProxy = {
  // Set proxy mode before test
  async before(testInfo: PlaywrightTestInfo, mode: 'record' | 'replay' | 'transparent'): Promise<void>;

  // Reset to transparent mode after test
  async after(testInfo: PlaywrightTestInfo): Promise<void>;
};
```

### Global Teardown and Hooks Setup (Recommended)

For robust test setups, it's recommended to configure global teardown and afterEach hooks to ensure the proxy is properly reset even when tests fail. This prevents the proxy from staying in record/replay mode, which could affect subsequent test runs.

#### 1. Create Global Teardown File

Create `e2e/global-teardown.ts` to reset the proxy mode after all tests complete:

```typescript
import { setProxyMode } from 'test-proxy-recorder';

async function globalTeardown() {
  await setProxyMode('transparent');
}

export default globalTeardown;
```

#### 2. Create Global Hooks File

Create `e2e/global-hooks.ts` to ensure proxy cleanup happens after each test, even on failure:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

/**
 * Global afterEach hook to ensure proxy cleanup happens even when tests fail.
 * This will run after every test across all test files.
 */
test.afterEach(async ({}, testInfo) => {
  try {
    await playwrightProxy.after(testInfo);
  } catch (error) {
    console.error('Error during proxy cleanup:', error);
    // Don't throw - we want cleanup to continue even if this fails
  }
});
```

#### 3. Configure Playwright

Update your `playwright.config.ts` to include the global teardown:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  // ... rest of your config
});
```

#### 4. Import Global Hooks in Your Base Page or Test Setup

Import the global hooks file in your base test file or base page to register the afterEach hook:

```typescript
// In your e2e/basePage.ts or similar base test file
import { test as base } from '@playwright/test';

// Import global hooks to register afterEach for proxy cleanup
import './global-hooks';

export const test = base.extend({
  // your fixtures
});
```

## Recording Format

Recordings are stored as JSON files with `.mock.json` extension in the recordings directory:

```text
recordings/
├── test-session-1.mock.json
├── test-session-2.mock.json
└── ...
```

Each recording contains:

- Request/response pairs with headers and bodies
- WebSocket messages with timestamps
- Unique keys for request matching during replay

## Typical Workflow

1. **Start the proxy server** (runs continuously):

   ```bash
   test-proxy-recorder http://localhost:8000 --port 8100
   ```

2. **Configure your app** to use the proxy (point your app to the proxy port, e.g., 8100)

3. **Record responses** (first run):

   ```typescript
   test('my test', async ({ page }, testInfo) => {
     await playwrightProxy.before(testInfo, 'record');
     // Test interacts with real API through proxy
     await page.goto('/my-page');
     await playwrightProxy.after(testInfo);
   });
   ```

4. **Replay responses** (subsequent runs):

   ```typescript
   test('my test', async ({ page }, testInfo) => {
     await playwrightProxy.before(testInfo, 'replay');
     // Test uses recorded responses - no real API calls
     await page.goto('/my-page');
     await playwrightProxy.after(testInfo);
   });
   ```

## Requirements

- Node.js >= 22.0.0
- @playwright/test >= 1.0.0

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
