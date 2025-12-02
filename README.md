# test-proxy-recorder

[![npm](https://img.shields.io/npm/v/test-proxy-recorder.svg)](https://www.npmjs.com/package/test-proxy-recorder)
[![license](https://img.shields.io/github/license/asmyshlyaev177/test-proxy-recorder.svg?style=flat-square)](https://github.com/asmyshlyaev177/test-proxy-recorder/blob/master/LICENSE)

HTTP proxy server for recording and replaying network requests in testing. Works seamlessly with Playwright and other testing frameworks.

## BETA VERSION

## Features

- **Fast CI/CD Tests**: Record API responses once with real backend, replay them on CI/CD without backend
- **Fast Workflow**: Record real interactions with API instead of mocking every request manually
- **Server Side Rendering**: Can record SSR requests from JS frameworks like Next.js
- **Deterministic Tests**: Same responses every time, no flaky network issues, no need to wire up the whole Backend API for testing
- **WebSocket Support**: Records and replays WebSocket connections

## Table of Contents

- [How It Works](#how-it-works)
- [Complete Setup Guide](#complete-setup-guide)
- [CLI Usage](#cli-usage)
- [Playwright Integration](#playwright-integration)
- [Control Endpoint](#control-endpoint)
- [Typical Workflow](#typical-workflow)
- [Recording Format](#recording-format)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## How It Works

The proxy server runs continuously and can switch between three modes per test:

### 1. Transparent Mode (Default)

Passes requests through to the backend without recording or replaying.

### 2. Record Mode

Captures all HTTP requests/responses and WebSocket messages to disk. Each test gets its own recording file based on the test name.

### 3. Replay Mode

Replays previously recorded responses from disk instead of hitting the real API. Perfect for fast, deterministic tests.

## Complete Setup Guide

### Step 1: Install Package

```bash
npm install --save-dev test-proxy-recorder
```

### Step 2: Add NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --recordings-dir ./e2e/recordings"
  }
}
```

**RECOMMENDED**: Use `concurrently` to run proxy and app together:

```bash
npm install --save-dev concurrently
```

```json
{
  "scripts": {
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --recordings-dir ./e2e/recordings",
    "dev:proxy": "concurrently -n \"proxy,app\" -c \"blue,green\" \"npm run proxy\" \"INTERNAL_API_URL=http://localhost:8100 npm run dev\""
  }
}
```

### Step 3: Configure Git for Recordings

**CRITICAL**: Recordings must be committed to git for CI/CD replay.

Create or update your `.gitattributes` file:

```gitattributes
/e2e/recordings/** binary
```

This marks recording files as binary, which causes long mock files to be collapsed/folded in Pull Request diffs for better readability.

**DO NOT** add `e2e/recordings` to `.gitignore`. Recordings need to be versioned in git for CI/CD to use them.

**Note**: The recordings directory will be created automatically when you first record a test - no need to create it manually.

### Step 4: Create Playwright Global Teardown (Recommended)

Create `e2e/global-teardown.ts`:

```typescript
import { playwrightProxy } from 'test-proxy-recorder';

async function globalTeardown() {
  await playwrightProxy.teardown();
}

export default globalTeardown;
```

Update `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  // ... rest of config
});
```

### Step 5: Create Example Test

Create `e2e/example.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Setup afterEach hook to reset proxy after each test
test.afterEach(async ({ page: _page }, testInfo) => {
  await playwrightProxy.after(testInfo);
});

test('example test with proxy', async ({ page }, testInfo) => {
  // Set proxy mode: 'record' to capture, 'replay' to use recordings
  await playwrightProxy.before(testInfo, 'replay');

  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### Step 6: Run Tests

**First run (record mode)**:

```typescript
await playwrightProxy.before(testInfo, 'record');
```

**Subsequent runs (replay mode)**:

```typescript
await playwrightProxy.before(testInfo, 'replay');
```

## CLI Usage

### Basic Command

```bash
test-proxy-recorder <target-url> [options]
```

### CLI Options

- `<target-url>` - Backend API URL (positional argument, required)
- `--port, -p <number>` - Port to listen on (default: 8080)
- `--recordings-dir, -r <path>` - Directory to store recordings (default: ./recordings)
- `--help, -h` - Show help

### Examples

```bash
# Basic usage
test-proxy-recorder http://localhost:8000

# Custom port and recordings directory
test-proxy-recorder http://localhost:8000 --port 8100 --recordings-dir ./mocks

# Multiple targets (experimental)
test-proxy-recorder http://localhost:8000 http://localhost:9000 --port 8100
```

## Playwright Integration

### Basic Test Structure

Every test file using the proxy should follow this pattern:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Setup afterEach hook once per test file
test.afterEach(async ({ page: _page }, testInfo) => {
  await playwrightProxy.after(testInfo);
});

test('test name', async ({ page }, testInfo) => {
  // 1. Set mode BEFORE test actions
  await playwrightProxy.before(testInfo, 'replay');

  // 2. Test code
  await page.goto('/page');
  // Test assertions...
});
```

### Recording vs Replay

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Setup afterEach hook to automatically cleanup after each test
test.afterEach(async ({ page: _page }, testInfo) => {
  await playwrightProxy.after(testInfo);
});

// Recording mode - captures API responses
test('create user', async ({ page }, testInfo) => {
  await playwrightProxy.before(testInfo, 'record');

  await page.goto('/users/new');
  await page.fill('[name="username"]', 'testuser');
  await page.click('button[type="submit"]');
});

// Replay mode - uses recorded responses
test('create user', async ({ page }, testInfo) => {
  await playwrightProxy.before(testInfo, 'replay');

  await page.goto('/users/new');
  await page.fill('[name="username"]', 'testuser');
  await page.click('button[type="submit"]');
});
```

### Test Naming

Recording files are auto-generated from test names:

- Test: `"create a user"`
- File: `create-a-user.mock.json`

**Important**: Keep test names stable for replay to work correctly.

### Global Teardown (Recommended)

Create `e2e/global-teardown.ts`:

```typescript
import { playwrightProxy } from 'test-proxy-recorder';

async function globalTeardown() {
  await playwrightProxy.teardown();
}

export default globalTeardown;
```

Update `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  // ... rest of config
});
```

## Control Endpoint

The proxy exposes a control endpoint at `/__control` for programmatic mode switching.

### Via HTTP

```bash
# Switch to record mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "my-test-1", "timeout": 30000}'

# Switch to replay mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "replay", "id": "my-test-1"}'

# Switch to transparent mode
curl -X POST http://localhost:8100/__control \
  -H "Content-Type: application/json" \
  -d '{"mode": "transparent"}'
```

### Via JavaScript

```javascript
await fetch('http://localhost:8100/__control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'record',
    id: 'my-test-1',
    timeout: 30000 // Optional: auto-reset after 30s
  })
});
```

### Control Request Interface

```typescript
interface ControlRequest {
  mode: 'transparent' | 'record' | 'replay';
  id?: string;      // Recording ID, required for record/replay
  timeout?: number; // Auto-reset timeout in ms (default: 120000)
}
```

## Typical Workflow

### Initial Recording

1. Start backend API: `npm run api`
2. Start proxy and app: `npm run dev:proxy`
3. Set test to `'record'` mode
4. Run test: Recordings saved to `./e2e/recordings/` (directory created automatically)
5. Commit `.mock.json` files to git
6. Change mode to `'replay'`

### Running with Replay

1. Start proxy and app: `npm run dev:proxy` (no backend needed!)
2. Set test to `'replay'` mode
3. Run test: Uses recorded responses
4. Tests run fast without backend

### Updating Recordings

1. Start backend API
2. Set test to `'record'` mode
3. Run test: Overwrites existing recording
4. Commit updated `.mock.json` file

## Recording Format

Recordings are stored as JSON files with `.mock.json` extension:

```text
e2e/recordings/
├── create-a-user.mock.json
├── fetch-users-list.mock.json
└── delete-user.mock.json
```

## Troubleshooting

### Proxy not responding

**Check if proxy is running**:

```bash
curl http://localhost:8100/__control
```

**Check port availability**:

```bash
lsof -i :8100
```

### No recordings saved

- Verify proxy mode is `'record'`
- Check app is using proxy URL (`http://localhost:8100`)
- Verify write permissions on recordings directory
- Check proxy server logs for errors

### Test fails in replay mode

- Ensure recording exists for this test
- Check test name hasn't changed
- Verify recording file matches expected format
- Re-record if API responses changed

### Recordings not matching requests

- Request URLs must match exactly
- Headers may affect matching (configurable)
- Query parameters must be in same order
- Re-record to capture current API behavior


## API Reference

### ProxyServer Class

```typescript
class ProxyServer {
  constructor(targets: string[], recordingsDir: string);
  async init(): Promise<void>;
  listen(port: number): http.Server;
}
```

### Playwright Integration

```typescript
import { playwrightProxy, setProxyMode } from 'test-proxy-recorder';

// Main helper for Playwright tests
const playwrightProxy = {
  // Set proxy mode before test
  async before(
    testInfo: TestInfo,
    mode: 'record' | 'replay' | 'transparent',
    timeout?: number
  ): Promise<void>;

  // Reset replay session and return to transparent mode after test
  // Resets sequence counters to ensure next replay starts fresh
  async after(testInfo: TestInfo): Promise<void>;

  // Global teardown - switches proxy to transparent mode
  // Use in Playwright's globalTeardown configuration
  async teardown(): Promise<void>;
};

// Direct mode control
async function setProxyMode(
  mode: 'record' | 'replay' | 'transparent',
  id?: string,
  timeout?: number
): Promise<void>;
```

### Control Endpoint

**Endpoint**: `POST http://localhost:8100/__control`

**Request Body**:

```typescript
{
  mode: 'transparent' | 'record' | 'replay';
  id?: string;      // Recording ID (required for record/replay)
  timeout?: number; // Auto-reset timeout in ms (default: 120000)
}
```

**Note**: Switching to replay mode automatically resets session counters (clears served recordings tracker), allowing replay from the beginning.

**Response**:

```typescript
{
  success: boolean;
  mode: string;
  id: string | null;
  timeout: number;
}
```

## Requirements

- Node.js >= 22.0.0
- @playwright/test >= 1.0.0 (for Playwright integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
