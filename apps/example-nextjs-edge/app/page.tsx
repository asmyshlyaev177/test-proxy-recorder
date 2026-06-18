import TodoList, { type Todo } from './components/TodoList';

// This page renders on the Edge runtime. Its server-side fetch below goes
// through the proxy, so the proxy must be able to tell which recording session
// the request belongs to — see the README and e2e/ssr.spec.ts.
export const runtime = 'edge';
// Always render on the server per request (no caching), so every navigation
// triggers a fresh SSR fetch through the proxy.
export const dynamic = 'force-dynamic';

// Dev/test: point at the proxy so the SSR request is recorded/replayed.
// Production: point at the real backend.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8110';

export default async function Page() {
  let todos: Todo[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/todos`, { cache: 'no-store' });
    if (res.ok) todos = (await res.json()) as Todo[];
  } catch {
    // backend not ready — render empty list
  }
  return <TodoList todos={todos} />;
}
