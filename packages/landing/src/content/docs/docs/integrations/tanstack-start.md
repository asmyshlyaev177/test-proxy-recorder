---
title: TanStack Start
description: A first-class TanStack Start integration for test-proxy-recorder is on the roadmap. Until it lands, propagate the recording-session header from server functions by hand.
---

:::caution[On the roadmap]
A first-class `test-proxy-recorder/tanstack-start` adapter is planned but not shipped yet. This page describes the manual pattern that works today, and will be replaced with the dedicated guide once the adapter lands. Want it sooner? [Open an issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

TanStack Start runs loaders and server functions on the server, so their `fetch` calls go through the proxy without a browser context — the same situation as [Next.js SSR](/docs/integrations/nextjs/). The proxy needs the `x-test-rcrd-id` header on those server-side requests to attribute them to the right recording session.

## Manual pattern (works today)

The header that `playwrightProxy.before()` sets on the browser `page` arrives on the incoming server request. Read it there and forward it on any server-side `fetch`:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';

// Inside a server function / loader, read the incoming request headers and
// forward the recording id to your backend fetch. RECORDING_ID_HEADER is
// 'x-test-rcrd-id'.
function withRecordingId(incoming: Headers, extra?: Record<string, string>) {
  const headers: Record<string, string> = { ...extra };
  const id = incoming.get(RECORDING_ID_HEADER);
  if (id) headers[RECORDING_ID_HEADER] = id;
  return headers;
}
```

Point your backend base URL at the proxy (`http://localhost:8100`) in dev/test only, exactly as in the [manual setup](/docs/getting-started/manual-setup/). Browser-side requests are still handled by `playwrightProxy.before()`'s HAR mechanism.

Once the adapter ships, this reduces to a single helper import — track progress on the [roadmap](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
