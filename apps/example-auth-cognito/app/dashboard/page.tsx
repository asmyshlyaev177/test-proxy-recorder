'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TodoApp, { type Todo } from 'example-auth-shared/TodoApp';

import { API_BASE, clearToken, getToken } from '../lib/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [token, setTok] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace('/login');
      return;
    }
    setTok(t);
    // Initial load of the PROTECTED resource, carrying the Cognito access token
    // as a Bearer header. This request goes through the proxy and is recorded;
    // the recorder redacts the Authorization header from the saved recording.
    fetch(`${API_BASE}/protected/todos`, {
      headers: { authorization: `Bearer ${t}` },
    })
      .then((res) => {
        if (res.status === 401) {
          clearToken();
          setTok(null); // also clear in-memory, or we'd flash the signed-in view
          router.replace('/login');
          return [];
        }
        return res.json();
      })
      .then((data: Todo[]) => setTodos(data))
      .catch(() => setTodos([]));
  }, [router]);

  if (!token || todos === null) {
    return (
      <div className="container">
        <p data-testid="dashboard-status">loading</p>
      </div>
    );
  }

  function signOut() {
    clearToken();
    router.replace('/login');
  }

  return (
    <>
      <div className="container" style={{ paddingBottom: 0 }}>
        <p className="muted" data-testid="dashboard-status">
          Signed in —{' '}
          <button className="btn-ghost" onClick={signOut} data-testid="signout-btn">
            Sign out
          </button>
        </p>
      </div>
      <TodoApp
        initialTodos={todos}
        basePath="/protected/todos"
        extraHeaders={{ authorization: `Bearer ${token}` }}
      />
    </>
  );
}
