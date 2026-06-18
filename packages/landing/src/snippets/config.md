```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    // Playwright starts the proxy for the run and stops it after — you don't operate it.
    command: 'test-proxy-recorder http://localhost:8000 --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```
