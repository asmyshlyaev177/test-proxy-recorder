import { type Todo } from '../components/TodoApp';

// ISR via fetch-level caching: the todos fetch is cached for 30s with
// `next.revalidate` + `next.tags`, so within that window requests are served
// WITHOUT hitting the backend. In production (no TEST_PROXY_RECORDER_ENABLED),
// no dynamic function is called and Next.js statically prerenders the page with
// 30s ISR — the standard caching pattern. During testing, the patched fetch
// (registerProxyFetch in layout.tsx) calls `headers()` to tag the request with
// the recording id, which makes the page render dynamically — but the fetch
// data is still cached for 30s, so the caching behaviour is exercised.
// (The home page, by contrast, is live data: `no-store`.)
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8100';

// Use fetch with `next.revalidate` + `next.tags` — the standard Next.js ISR data
// primitive. Unlike `unstable_cache` (which runs its callback in a detached scope
// where `headers()` is unavailable AND which serves stale-while-revalidate on
// revalidation), fetch with `next.revalidate` runs in the request scope where
// registerProxyFetch() can tag it, and `revalidateTag` is a hard purge — so the
// next request re-runs the fetch through the proxy deterministically (no poll).
// Invalidated on demand via /api/revalidate.
export default async function IsrPage() {
  let todos: Todo[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/todos`, {
      next: { revalidate: 30, tags: ['isr-todos'] },
    });
    if (res.ok) todos = await res.json();
  } catch {
    // backend not ready — render empty list
  }
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
