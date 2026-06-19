import TodoApp, { type Todo } from './components/TodoApp';

// NOTE: BACKEND_URL controls where SSR fetches go.
// Dev/test: point to the proxy (http://localhost:8100) so SSR requests are also recorded.
// Production: point to the real backend URL directly.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8100';

export default async function Page() {
  let todos: Todo[] = [];
  try {
    // A todo list is live data, so the realistic production choice is to always
    // fetch fresh (no caching) — this is the app's real behaviour, not a
    // test-only setting. `no-store` also keeps the route dynamic, so each SSR
    // request runs in a request scope where registerProxyFetch() (app/layout.tsx)
    // can tag it with the recording id. (See the /isr route for the cached/ISR
    // counterpart recorded through the proxy.)
    const res = await fetch(`${BACKEND_URL}/todos`, { cache: 'no-store' });
    if (res.ok) todos = await res.json();
  } catch {
    // backend not ready yet — render empty list
  }
  return (
    <>
      <TodoApp initialTodos={todos} />
      <div className="container">
        <a href="/websocket">WebSocket demo →</a>
      </div>
    </>
  );
}
