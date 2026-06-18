---
title: React Router / Remix
description: A first-class React Router 7 (framework mode) and Remix integration for test-proxy-recorder is on the roadmap. Until it lands, forward the recording-session header from loaders and actions by hand.
---

:::caution[On the roadmap]
A first-class adapter for React Router 7 framework mode (what "Remix" means in practice now) is planned but not shipped yet. This page describes the manual pattern that works today, and will be replaced with the dedicated guide once the adapter lands. Want it sooner? [Open an issue](https://github.com/asmyshlyaev177/test-proxy-recorder/issues).
:::

React Router 7 loaders and actions run on the server, so their `fetch` calls go through the proxy without a browser context — the same situation as [Next.js SSR](/docs/integrations/nextjs/). The proxy needs the `x-test-rcrd-id` header on those server-side requests to attribute them to the right recording session.

## Manual pattern (works today)

Each loader/action receives the incoming `request`. Read the recording-id header off it and forward it on any server-side `fetch`:

```typescript
import { RECORDING_ID_HEADER } from 'test-proxy-recorder';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const headers: Record<string, string> = {};
  const id = request.headers.get(RECORDING_ID_HEADER); // 'x-test-rcrd-id'
  if (id) headers[RECORDING_ID_HEADER] = id;

  // Point the API base at the proxy in dev/test only.
  const res = await fetch('http://localhost:8100/api/data', { headers });
  return res.json();
}
```

Point your backend base URL at the proxy (`http://localhost:8100`) in dev/test only, exactly as in the [manual setup](/docs/getting-started/manual-setup/). Browser-side requests are still handled by `playwrightProxy.before()`'s HAR mechanism.

Once the adapter ships, this reduces to a single helper import — track progress on the [roadmap](https://github.com/asmyshlyaev177/test-proxy-recorder#readme).
