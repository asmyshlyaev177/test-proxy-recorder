```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'test-proxy-recorder https://api.example.com --port 8100 --dir ./e2e/recordings',
    url: 'http://localhost:8100/__control',
    reuseExistingServer: true,
  },
});
```
