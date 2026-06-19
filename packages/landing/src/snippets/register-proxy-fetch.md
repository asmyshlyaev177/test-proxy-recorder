```ts
// app/layout.tsx — tag server-side fetches so SSR is recorded/replayed
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';

registerProxyFetch(); // no-op in production unless TEST_PROXY_RECORDER_ENABLED=true
```
