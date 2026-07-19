import { queryOptions } from '@tanstack/react-query';

import { fetchSecret, fetchTodos } from './lib/api';

// Shared query definitions. The same `todosQueryOptions` is prefetched in the
// route loader on the server (tagged by registerProxyFetch → recorded as
// .mock.json) and consumed by `useSuspenseQuery` in the component, so the
// server-rendered data hydrates the client with no extra fetch.
export const todosQueryOptions = queryOptions({
  queryKey: ['todos'],
  queryFn: fetchTodos,
});

// A separate key for the ISR route so its cached-route render is independent of
// the live home page.
export const isrTodosQueryOptions = queryOptions({
  queryKey: ['isr-todos'],
  queryFn: fetchTodos,
});

// Client-only (no loader prefetch): fetched on mount, recorded via HAR.
export const secretQueryOptions = queryOptions({
  queryKey: ['secret'],
  queryFn: fetchSecret,
  retry: false,
});
