```ts
// Point your app at the proxy when the recorder is enabled, at the real backend otherwise.
// The proxy never runs in production — TEST_PROXY_RECORDER_ENABLED is set only for e2e.
const API_BASE =
  process.env.NODE_ENV === 'production' && !process.env.TEST_PROXY_RECORDER_ENABLED
    ? 'https://api.example.com'
    : 'http://localhost:8100'; // proxy address from `init`

const res = await fetch(`${API_BASE}/todos`);
```
