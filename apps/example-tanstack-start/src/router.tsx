import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { registerProxyFetch } from 'test-proxy-recorder/tanstack-start';

import { routeTree } from './routeTree.gen';

// Patch the server-side `fetch` so every SSR request (route loaders, TanStack
// Query prefetches, server routes) carries the current test's recording-session
// id (`x-test-rcrd-id`). This is what lets the proxy attribute server-side
// requests to the right test and keep parallel replay correct — the TanStack
// Start equivalent of the Next.js `registerProxyFetch()` in `app/layout.tsx`.
//
// It runs at server module-load, is a no-op on the client, and a no-op in
// production unless TEST_PROXY_RECORDER_ENABLED is set. Because it patches the
// global `fetch`, it tags TanStack Query's `queryFn` fetches during SSR prefetch
// automatically — the data layer needs no special wiring. Record against a
// production build (`vite build` + `node .output/server/index.mjs`), not
// `vite dev` — see e2e/ssr.spec.ts.
registerProxyFetch();

export function getRouter() {
  // A fresh QueryClient per request keeps SSR state from leaking between users.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  });

  // Dehydrate the query cache on the server and rehydrate it on the client, so
  // loader-prefetched data lands in the browser with no extra fetch.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
