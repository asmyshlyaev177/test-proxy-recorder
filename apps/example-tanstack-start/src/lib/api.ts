export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

// Resolve the API base per environment. On the server (SSR loaders / prefetch)
// use BACKEND_URL; in the browser use the build-time VITE_API_URL. Both default
// to the proxy in dev/test so every request — server-side and browser-side — is
// recorded; in production they point at the real backend.
//
// The `process.env` branch only runs on the server (guarded by `typeof window`),
// so it never trips "process is not defined" in the client bundle.
function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.BACKEND_URL ?? 'http://localhost:8100';
  }
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8100';
}

export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${apiBase()}/todos`);
  if (!res.ok) throw new Error(`GET /todos failed: ${res.status}`);
  return (await res.json()) as Todo[];
}

export async function createTodo(text: string): Promise<Todo> {
  const res = await fetch(`${apiBase()}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`POST /todos failed: ${res.status}`);
  return (await res.json()) as Todo;
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, 'text' | 'completed'>>,
): Promise<Todo> {
  const res = await fetch(`${apiBase()}/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`PUT /todos/${id} failed: ${res.status}`);
  return (await res.json()) as Todo;
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/todos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE /todos/${id} failed: ${res.status}`);
}

export interface SecretResponse {
  ok: boolean;
  message: string;
}

export async function fetchSecret(): Promise<SecretResponse> {
  // Carries an Authorization header + receives a secret in the response — the
  // recorder must redact both before the .har is committed (see e2e/assert-redactions).
  const res = await fetch(`${apiBase()}/secret`, {
    headers: {
      authorization: 'Bearer super-secret-har-jwt',
      'x-api-key': 'har-key-secret',
    },
  });
  if (!res.ok) throw new Error(`GET /secret failed: ${res.status}`);
  return (await res.json()) as SecretResponse;
}

// ─────────────────────────────────────────────────────────────────────────────
// Protected resource — requires a Cognito access token (a JWT). The authenticated
// dashboard calls these from the BROWSER through the proxy, carrying the token as
// an `Authorization: Bearer …` header. The recorder redacts that header from the
// saved recordings. See src/routes/dashboard.tsx and e2e/auth.spec.ts.
//
// Unlike the public `/todos` list, these are NOT SSR-prefetched: the token lives
// in the browser's localStorage, so the fetch necessarily runs client-side and is
// recorded via HAR (like /secret), not as a server-side .mock.json.
// ─────────────────────────────────────────────────────────────────────────────

function authHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return { authorization: `Bearer ${token}`, ...extra };
}

export async function fetchProtectedTodos(token: string): Promise<Todo[]> {
  const res = await fetch(`${apiBase()}/protected/todos`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GET /protected/todos failed: ${res.status}`);
  return (await res.json()) as Todo[];
}

export async function createProtectedTodo(
  token: string,
  text: string,
): Promise<Todo> {
  const res = await fetch(`${apiBase()}/protected/todos`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`POST /protected/todos failed: ${res.status}`);
  return (await res.json()) as Todo;
}

export async function updateProtectedTodo(
  token: string,
  id: string,
  updates: Partial<Pick<Todo, 'text' | 'completed'>>,
): Promise<Todo> {
  const res = await fetch(`${apiBase()}/protected/todos/${id}`, {
    method: 'PUT',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`PUT /protected/todos/${id} failed: ${res.status}`);
  return (await res.json()) as Todo;
}

export async function deleteProtectedTodo(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${apiBase()}/protected/todos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`DELETE /protected/todos/${id} failed: ${res.status}`);
}
