// Four batches of different sizes, posted at once to one path from the server,
// as an app filling an embeddings index does. They share a recording key, so
// replay can tell them apart only by body (e2e/parallel.spec.ts).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8100';

const BATCHES = [1, 2, 3, 4].map((size) => ({
  name: `batch-${size}`,
  input: Array.from({ length: size }, (_, index) => `batch-${size} text ${index + 1}`),
}));

async function countEmbeddings(input: string[]): Promise<number> {
  const res = await fetch(`${BACKEND_URL}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`POST /embeddings failed: ${res.status}`);
  const { data } = (await res.json()) as { data: unknown[] };
  return data.length;
}

export default async function ParallelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { order } = await searchParams;
  // ?order=reverse sends the same batches the other way round, so a test can replay them in an order other than the recorded one.
  const sendOrder = order === 'reverse' ? [...BATCHES].reverse() : BATCHES;
  const received = new Map(
    await Promise.all(
      sendOrder.map(async (batch) => [batch.name, await countEmbeddings(batch.input)] as const),
    ),
  );

  return (
    <main className="container">
      <h1>Parallel requests</h1>
      <ul>
        {BATCHES.map((batch) => (
          <li key={batch.name} data-testid="batch-result">
            {batch.name}: {batch.input.length} sent, {received.get(batch.name)} received
          </li>
        ))}
      </ul>
    </main>
  );
}
