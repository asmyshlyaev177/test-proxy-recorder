import { createFileRoute } from '@tanstack/react-router';

import { countEmbeddings, EMBEDDING_BATCHES } from '~/lib/api';

// The loader runs during SSR, so the four POSTs go out from the server at once
// (e2e/parallel.spec.ts).
export const Route = createFileRoute('/parallel')({
  // ?order=reverse sends the same batches the other way round, so a test can replay them in an order other than the recorded one.
  validateSearch: (search: Record<string, unknown>): { order?: 'reverse' } =>
    search.order === 'reverse' ? { order: 'reverse' } : {},
  loaderDeps: ({ search }) => ({ order: search.order }),
  loader: async ({ deps }) => {
    const sendOrder =
      deps.order === 'reverse' ? [...EMBEDDING_BATCHES].reverse() : EMBEDDING_BATCHES;
    const received = await Promise.all(
      sendOrder.map(
        async (batch) => [batch.name, await countEmbeddings(batch.input)] as const,
      ),
    );
    return Object.fromEntries(received);
  },
  component: ParallelPage,
});

function ParallelPage() {
  const received = Route.useLoaderData();
  return (
    <main className="container">
      <h1>Parallel requests</h1>
      <ul>
        {EMBEDDING_BATCHES.map((batch) => (
          <li key={batch.name} data-testid="batch-result">
            {batch.name}: {batch.input.length} sent, {received[batch.name]} received
          </li>
        ))}
      </ul>
    </main>
  );
}
