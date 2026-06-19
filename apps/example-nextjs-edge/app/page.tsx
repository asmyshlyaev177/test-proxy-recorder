import TodoList, { type Todo } from './components/TodoList';

// This page renders on the Edge runtime. Its server-side fetch below goes
// through the proxy, so the proxy must be able to tell which recording session
// the request belongs to — see the README and e2e/ssr.spec.ts.
export const runtime = 'edge';

// Dev/test: point at the proxy so the SSR request is recorded/replayed.
// Production: point at the real backend.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8110';

export default async function Page() {
  let todos: Todo[] = [];
  try {
    // A todo list is live data, so the realistic production choice is to always
    // fetch fresh (no caching) — this is the app's real behaviour, not a
    // test-only setting. `no-store` also keeps the route dynamic, so each SSR
    // request runs in a request scope where registerProxyFetch() can tag it with
    // the recording id. (For a cached/ISR page recorded through the proxy, see
    // the /isr route in the example-nextjs16 app.)
    const res = await fetch(`${BACKEND_URL}/todos`, { cache: 'no-store' });
    if (res.ok) todos = (await res.json()) as Todo[];
  } catch {
    // backend not ready — render empty list
  }
  return <TodoList todos={todos} />;
}
