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
- [Next.js Integration](#nextjs-integration)
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
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings"
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
    "proxy": "test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings",
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

test('example test with proxy', async ({ page }, testInfo) => {
  // Set proxy mode: 'record' to capture, 'replay' to use recordings
  // This automatically sets up page.on('close') for cleanup
  await playwrightProxy.before(page, testInfo, 'replay');

  await page.goto('/');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

### Step 6: Run Tests

**First run (record mode)**:

```typescript
await playwrightProxy.before(page, testInfo, 'record');
```

**Subsequent runs (replay mode)**:

```typescript
await playwrightProxy.before(page, testInfo, 'replay');
```

## CLI Usage

### Basic Command

```bash
test-proxy-recorder <target-url> [options]
```

### CLI Options

- `<target-url>` - Backend API URL (positional argument, required)
- `--port, -p <number>` - Port to listen on (default: 8080)
- `--dir, -d <path>` - Directory to store recordings (default: ./recordings)
- `--help, -h` - Show help

### Examples

```bash
# Basic usage
test-proxy-recorder http://localhost:8000

# Custom port and recordings directory
test-proxy-recorder http://localhost:8000 --port 8100 --dir ./mocks

# Multiple targets (experimental)
test-proxy-recorder http://localhost:8000 http://localhost:9000 --port 8100
```

## Playwright Integration

### Session Identification

The proxy uses a **custom HTTP header** (`x-test-rcrd-id`) to identify recording sessions. This header is automatically set by the `playwrightProxy.before()` method and works seamlessly with Next.js and other server-side rendering frameworks.

**Cookie fallback**: For backward compatibility, the proxy also supports cookie-based session identification, but the custom header is preferred.

### Basic Test Structure

Every test using the proxy should follow this pattern:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('test name', async ({ page }, testInfo) => {
  // Set mode BEFORE test actions
  // This automatically sets the recording ID header and cleanup handler
  await playwrightProxy.before(page, testInfo, 'replay');

  // Test code
  await page.goto('/page');
  // Test assertions...
});
```

### Recording vs Replay

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// Recording mode - captures API responses
test('create user', async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'record');

  await page.goto('/users/new');
  await page.fill('[name="username"]', 'testuser');
  await page.click('button[type="submit"]');
});

// Replay mode - uses recorded responses
test('create user', async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, 'replay');

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

### Client-Side Recording for 3rd Party APIs

For applications that make client-side requests to 3rd party services (e.g., AWS Cognito, Stream.io, analytics services), you can use client-side recording to capture these requests directly in the browser using Playwright's HAR (HTTP Archive) format.

**Why use client-side recording?**
- Server-side proxy cannot intercept requests made directly from the browser to external services
- HAR files are a standard format supported by Playwright and browser dev tools
- Automatically handles CORS and other browser-specific request behaviors

**Example:**

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('authentication flow', async ({ page }, testInfo) => {
  // Record both server-side (via proxy) and client-side (via HAR) requests
  await playwrightProxy.before(
    page,
    testInfo,
    'replay',
    {
      // Client-side URL pattern using Playwright's format
      url: /cognito-.*amazonaws\.com|\.stream-io-api\.com/,
      timeout: 60000 // Optional: custom timeout
    }
  );

  await page.goto('/login');
  // Cognito authentication requests are recorded to HAR files
  await page.fill('[name="email"]', 'user@example.com');
  await page.click('button[type="submit"]');
});
```

**URL Pattern Options:**
```typescript
// RegExp pattern (recommended for multiple domains)
{ url: /cognito-.*amazonaws\.com|\.stream-io-api\.com/ }

// String glob pattern
{ url: 'https://api.example.com/**' }

// Specific domain
{ url: /api\.external-service\.com/ }
```

**Storage:**
Client-side recordings are stored as HAR files alongside server-side recordings:
```
e2e/recordings/
├── my-test.mock.json  # Server-side recordings (proxy)
└── my-test.har        # Client-side recordings (browser)
```

**Recording vs Replay:**
- **Record mode**: Creates/updates HAR file with actual responses from 3rd party services
- **Replay mode**: Uses recorded HAR file, no network requests made to 3rd party services

**Note:** The recordings directory is automatically retrieved from the proxy server, ensuring both server-side and client-side recordings are stored in the same location.

## Next.js Integration

When testing Next.js applications with server-side rendering (SSR) or API routes, you need to ensure the recording ID header is forwarded to the proxy. The package provides helpers for this.

### Option 1: Using Next.js Middleware (Recommended)

Create or update `middleware.ts` in your Next.js project root:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Forward the recording ID header during tests
  // Only runs in non-production or when TEST_PROXY_RECORDER_ENABLED=true
  setNextProxyHeaders(request, response);

  return response;
}
```

**Environment Variables:**
- Automatically skipped when `NODE_ENV=production`
- Can be explicitly enabled in production with `TEST_PROXY_RECORDER_ENABLED=true`

### Option 2: Manual Header Forwarding in API Routes

For API routes or server components, manually include the header in fetch requests:

```typescript
// app/api/data/route.ts
import { headers } from 'next/headers';
import { createHeadersWithRecordingId } from 'test-proxy-recorder/nextjs';

export async function GET() {
  const requestHeaders = await headers();

  const response = await fetch('http://localhost:8100/api/data', {
    headers: createHeadersWithRecordingId(requestHeaders, {
      'Content-Type': 'application/json',
    })
  });

  return Response.json(await response.json());
}
```

### Option 3: Using getRecordingId Helper

For more control, extract the recording ID and use it manually:

```typescript
import { headers } from 'next/headers';
import { getRecordingId, RECORDING_ID_HEADER } from 'test-proxy-recorder/nextjs';

export async function GET() {
  const recordingId = getRecordingId(await headers());

  const response = await fetch('http://localhost:8100/api/data', {
    headers: {
      'Content-Type': 'application/json',
      ...(recordingId && { [RECORDING_ID_HEADER]: recordingId })
    }
  });

  return Response.json(await response.json());
}
```

## Control Endpoint

The proxy exposes a control endpoint at `/__control` for programmatic mode switching and configuration retrieval.

### GET - Retrieve Proxy Configuration

Get the current proxy configuration including recordings directory, mode, and active session ID.

**Via HTTP:**
```bash
curl http://localhost:8100/__control
```

**Response:**
```json
{
  "recordingsDir": "/path/to/e2e/recordings",
  "mode": "replay",
  "id": "my-test-1"
}
```

**Via JavaScript:**
```javascript
const config = await fetch('http://localhost:8100/__control').then(r => r.json());
console.log(config.recordingsDir); // "/path/to/e2e/recordings"
console.log(config.mode);          // "replay"
console.log(config.id);            // "my-test-1"
```

### POST - Switch Proxy Mode

**Via HTTP:**
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

**Via JavaScript:**
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

interface ControlResponse {
  recordingsDir: string;
  mode: string;
  id?: string;
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

Recordings are stored in two formats depending on the recording type:

**Server-side recordings** (via proxy): JSON files with `.mock.json` extension
**Client-side recordings** (via HAR): HTTP Archive files with `.har` extension

```text
e2e/recordings/
├── create-a-user.mock.json       # Server-side API calls
├── create-a-user.har             # Client-side 3rd party requests
├── fetch-users-list.mock.json
└── delete-user.mock.json
```

Both file types use the same naming convention based on the test name, making it easy to identify which recordings belong to which test.

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
import { playwrightProxy, setProxyMode, RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { Page } from '@playwright/test';

// Client-side recording options
interface ClientSideRecordingOptions {
  /**
   * URL pattern for client-side requests to record/replay
   * Uses Playwright's native format (string or RegExp)
   * Example: /cognito-.*amazonaws\.com|\.stream-io-api\.com/
   * Example: 'https://api.example.com/**'
   */
  url?: string | RegExp;
}

// Main helper for Playwright tests
const playwrightProxy = {
  // Set proxy mode before test and configure page with recording ID header
  // Supports optional client-side recording for 3rd party APIs
  async before(
    page: Page,
    testInfo: TestInfo,
    mode: 'record' | 'replay' | 'transparent',
    options?: number | (ClientSideRecordingOptions & { timeout?: number })
  ): Promise<void>;

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

// Recording ID header constant
const RECORDING_ID_HEADER: string; // 'x-test-rcrd-id'
```

**Options Parameter:**
- `number` - Legacy format: timeout in milliseconds
- `ClientSideRecordingOptions & { timeout?: number }` - Object with optional client-side recording and timeout:
  - `url?: string | RegExp` - URL pattern for client-side recording (uses Playwright's HAR format)
  - `timeout?: number` - Auto-reset timeout in milliseconds

### Next.js Integration

**IMPORTANT**: Use the `/nextjs` import path to avoid webpack bundling issues in Next.js:

```typescript
import {
  setNextProxyHeaders,
  getRecordingId,
  createHeadersWithRecordingId,
  RECORDING_ID_HEADER
} from 'test-proxy-recorder/nextjs';
import type { NextRequest, NextResponse } from 'next/server';

// Forward recording ID header in Next.js middleware
// Automatically skipped in production unless TEST_PROXY_RECORDER_ENABLED=true
function setNextProxyHeaders(
  request: NextRequest,
  response: NextResponse
): void;

// Get recording ID from request headers
function getRecordingId(
  requestHeaders: NextRequest | Headers
): string | null;

// Create headers object with recording ID for fetch requests
function createHeadersWithRecordingId(
  requestHeaders: NextRequest | Headers,
  additionalHeaders?: Record<string, string>
): Record<string, string>;
```

### Control Endpoint

The control endpoint supports both GET and POST methods.

**GET `/__control`** - Retrieve proxy configuration:

```typescript
// Response
{
  recordingsDir: string;  // Path to recordings directory
  mode: string;           // Current mode: 'transparent' | 'record' | 'replay'
  id?: string;            // Active recording/replay session ID
}
```

**POST `/__control`** - Switch proxy mode:

```typescript
// Request Body
{
  mode: 'transparent' | 'record' | 'replay';
  id?: string;      // Recording ID (required for record/replay)
  timeout?: number; // Auto-reset timeout in ms (default: 120000)
}

// Response
{
  success: boolean;
  mode: string;
  id: string | null;
  timeout: number;
  recordingsDir: string;
}
```

**Note**: Switching to replay mode automatically resets session counters (clears served recordings tracker), allowing replay from the beginning.

## Requirements

- Node.js >= 22.0.0
- @playwright/test >= 1.0.0 (for Playwright integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
