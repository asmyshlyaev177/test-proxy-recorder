import TodoApp, { type Todo } from './components/TodoApp';

// NOTE: BACKEND_URL controls where SSR fetches go.
// Dev/test: point to the proxy (http://localhost:8100) so SSR requests are also recorded.
// Production: point to the real backend URL directly.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8100';

export default async function Page() {
  let todos: Todo[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/todos`, { cache: 'no-store' });
    if (res.ok) todos = await res.json();
  } catch {
    // backend not ready yet — render empty list
  }
  return <TodoApp initialTodos={todos} />;
}
