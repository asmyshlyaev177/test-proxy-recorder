import { createFileRoute } from '@tanstack/react-router';

import { TodoApp } from '~/components/TodoApp';
import { todosQueryOptions } from '~/queries';

// Prefetch the todos on the server via TanStack Query. `ensureQueryData` runs the
// query's `queryFn` (a `fetch`) during SSR — tagged with the recording id by the
// patched global `fetch` (registerProxyFetch in src/router.tsx) and recorded as
// `.mock.json`. The result is dehydrated to the client, so `useSuspenseQuery` in
// <TodoApp> renders immediately with no extra browser fetch on load.
export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQueryOptions),
  component: TodoApp,
});
