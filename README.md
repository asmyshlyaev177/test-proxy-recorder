# test-proxy-recorder

HTTP proxy server for recording and replaying network requests in testing. Works seamlessly with Playwright and other testing frameworks.

### BETA VERSION, NOT STABLE FOR PRODUCTION USE

## Features

- **Record Mode**: Capture HTTP/HTTPS requests and responses, including WebSocket connections
- **Replay Mode**: Replay captured requests from disk without hitting real endpoints
- **Transparent Mode**: Act as a simple proxy without recording or replaying
- **Playwright Integration**: Built-in fixture for easy integration with Playwright tests
- **WebSocket Support**: Full support for recording and replaying WebSocket connections
- **Multiple Targets**: Load balance between multiple backend targets
- **Timeout Control**: Automatic mode switching after configurable timeouts

## Installation

```bash
npm install test-proxy-recorder
# or
pnpm add test-proxy-recorder
# or
yarn add test-proxy-recorder
```

## Quick Start

### Standalone Usage

```typescript
import { ProxyServer } from 'test-proxy-recorder';

const proxy = new ProxyServer(
  ['http://localhost:3000'], // backend targets
  './recordings'             // directory to store recordings
);

await proxy.init();
const server = proxy.listen(8080);
console.log('Proxy running on http://localhost:8080');
```

### With Playwright

The proxy runs continuously in the background. Tests control the recording/replay mode using `playwrightProxy.before()` and `playwrightProxy.after()`:

```typescript
import { test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

test('record API responses', async ({ page }, testInfo) => {
  // Set proxy to recording mode for this test
  await playwrightProxy.before(testInfo, 'recording');

  // Make requests - they will be recorded
  await page.goto('http://localhost:8080/api/data');

  // Your test assertions here
  await expect(page.getByText('Data loaded')).toBeVisible();

  // Clean up - return to transparent mode
  await playwrightProxy.after(testInfo);
});

test('replay recorded responses', async ({ page }, testInfo) => {
  // Set proxy to replay mode - uses recording from test above
  await playwrightProxy.before(testInfo, 'replay');

  // This will use recorded responses instead of hitting the real API
  await page.goto('http://localhost:8080/api/data');

  await expect(page.getByText('Data loaded')).toBeVisible();

  await playwrightProxy.after(testInfo);
});
```

You can also use standalone functions for more control:

```typescript
import { test } from '@playwright/test';
import { setProxyMode, generateSessionId } from 'test-proxy-recorder';

test('custom proxy control', async ({ page }, testInfo) => {
  const sessionId = generateSessionId(testInfo);

  // Start recording with a 30s timeout
  await setProxyMode('recording', sessionId, 30000);

  await page.goto('http://localhost:8080/api/data');

  // Switch to transparent mode
  await setProxyMode('transparent', sessionId);
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

### Via Playwright (Recommended)

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

```bash
# Switch to record mode
curl -X POST http://localhost:8080/__proxy_control__ \
  -H "Content-Type: application/json" \
  -d '{"mode": "record", "id": "test-session-1", "timeout": 30000}'

# Switch to replay mode
curl -X POST http://localhost:8080/__proxy_control__ \
  -H "Content-Type: application/json" \
  -d '{"mode": "replay", "id": "test-session-1"}'

# Switch to transparent mode
curl -X POST http://localhost:8080/__proxy_control__ \
  -H "Content-Type: application/json" \
  -d '{"mode": "transparent", "id": "test-session-1"}'
```

## CLI Usage

```bash
# Start proxy server
test-proxy-recorder --port 8080 --target http://localhost:3000 --recordings ./recordings

# With multiple targets for load balancing
test-proxy-recorder --port 8080 \
  --target http://localhost:3000 \
  --target http://localhost:3001 \
  --recordings ./recordings
```

### CLI Options

- `--port, -p`: Port to listen on (default: 8080)
- `--target, -t`: Backend target URL (can be specified multiple times)
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

Send POST requests to `/__proxy_control__` with JSON body:

```typescript
interface ControlRequest {
  mode: 'transparent' | 'record' | 'replay';
  id?: string;      // Required for record/replay modes
  timeout?: number; // Auto-switch to transparent mode after timeout (ms)
}
```

### Playwright Integration API

```typescript
import { playwrightProxy } from 'test-proxy-recorder';

// Main helper object for use with Playwright tests
const playwrightProxy = {
  // Set proxy mode before test
  async before(testInfo: PlaywrightTestInfo, mode: 'recording' | 'replay' | 'transparent'): Promise<void>;

  // Reset to transparent mode after test
  async after(testInfo: PlaywrightTestInfo): Promise<void>;
};

// Standalone functions for custom control:
import {
  setProxyMode,        // Set mode with custom session ID
  generateSessionId,   // Generate session ID from test info
  startRecording,      // Helper to start recording
  startReplay,         // Helper to start replay
  stopProxy            // Helper to stop recording/replay
} from 'test-proxy-recorder';
```

### Usage Pattern

```typescript
test('your test', async ({ page }, testInfo) => {
  // Setup: Set proxy mode at start of test
  await playwrightProxy.before(testInfo, 'replay');

  // Your test code here
  await page.goto('/your-page');
  await expect(page.getByText('Something')).toBeVisible();

  // Cleanup: Return to transparent mode
  await playwrightProxy.after(testInfo);
});
```

## Recording Format

Recordings are stored as JSON files in the recordings directory:

```
recordings/
├── test-session-1.json
├── test-session-2.json
└── ...
```

Each recording contains:

- Request/response pairs with headers and bodies
- WebSocket messages with timestamps
- Unique keys for request matching during replay

## Typical Workflow

1. **Start the proxy server** (runs continuously):

   ```bash
   test-proxy-recorder http://localhost:3000 --port 8080
   ```

2. **Configure your app** to use the proxy:

   ```bash
   export EXTERNAL_API_URL=http://localhost:8080
   ```

3. **Record responses** (first run):

   ```typescript
   test('my test', async ({ page }, testInfo) => {
     await playwrightProxy.before(testInfo, 'recording');
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

## Use Cases

- **Fast CI/CD Tests**: Record API responses once, replay them for instant test execution
- **Deterministic Tests**: Same responses every time, no flaky network issues
- **API Contract Testing**: Verify frontend handles all API scenarios
- **WebSocket Testing**: Record and replay complex WebSocket message sequences

## Configuration Examples

### With Environment Variables

```typescript
const proxy = new ProxyServer(
  [process.env.BACKEND_URL || 'http://localhost:3000'],
  process.env.RECORDINGS_DIR || './recordings'
);
```

### Multiple Backend Targets

```typescript
// Round-robin load balancing between targets
const proxy = new ProxyServer(
  [
    'http://backend-1:3000',
    'http://backend-2:3000',
    'http://backend-3:3000'
  ],
  './recordings'
);
```

## WebSocket Support

WebSocket connections are automatically detected and recorded/replayed:

```typescript
test('websocket test', async ({ page }, testInfo) => {
  // Recording WebSocket messages
  await playwrightProxy.before(testInfo, 'recording');

  await page.goto('/websocket-page');
  // WebSocket connections and messages are recorded

  await playwrightProxy.after(testInfo);
});

test('websocket replay', async ({ page }, testInfo) => {
  // Replay WebSocket messages
  await playwrightProxy.before(testInfo, 'replay');

  await page.goto('/websocket-page');
  // Previously recorded WebSocket messages are replayed

  await playwrightProxy.after(testInfo);
});
```

## Requirements

- Node.js >= 22.0.0
- For Playwright integration: @playwright/test >= 1.0.0

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

asmyshlyaev177

## Repository

[https://github.com/asmyshlyaev177/test-proxy-recorder](https://github.com/asmyshlyaev177/test-proxy-recorder)
