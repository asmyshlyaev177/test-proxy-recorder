import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { isrTodosQueryOptions } from '~/queries';

// ISR in TanStack Start is HTTP-cache-header based (see `headers()` below): a CDN
// caches the HTML and revalidates in the background. The recorder must coexist
// with such a cached route — the SSR prefetch's `fetch` is still tagged with the
// recording id by the patched global `fetch` (registerProxyFetch in
// src/router.tsx), so record captures it and parallel replay serves it from the
// right session. (The home page, by contrast, is live data.)
export const Route = createFileRoute('/isr')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(isrTodosQueryOptions),
  // Cache at the CDN for 30s, serve stale while revalidating for a day. On-demand
  // invalidation (a CDN purge in production) is triggered by /api/revalidate.
  headers: () => ({
    'Cache-Control':
      'public, max-age=30, s-maxage=30, stale-while-revalidate=86400',
  }),
  component: IsrPage,
});

function IsrPage() {
  const { data: todos } = useSuspenseQuery(isrTodosQueryOptions);
  return (
    <main className="container">
      <h1>ISR Todos (cached 30s)</h1>
      <ul>
        {todos.map((t) => (
          <li key={t.id} data-testid="todo-text">
            {t.text}
          </li>
        ))}
      </ul>
    </main>
  );
}
