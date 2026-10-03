```ts
// The proxy during e2e runs, the real backend everywhere else.
// TEST_PROXY_RECORDER_ENABLED is 'true' or '1' for the e2e run only.
const recorderEnv = process.env.TEST_PROXY_RECORDER_ENABLED ?? '';
const API_BASE = ['true', '1'].includes(recorderEnv)
  ? 'http://localhost:8100' // proxy address from `init`
  : 'https://api.example.com';

const res = await fetch(`${API_BASE}/todos`);
```
