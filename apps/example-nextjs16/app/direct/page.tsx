'use client';

import { useEffect, useState } from 'react';

// The browser talks to the API itself here, as it would to a third-party
// service the proxy can't front (an auth provider, a chat SDK). The proxy never
// sees these requests, so they are recorded to the test's .har and replayed
// from it, unlike TodoApp's calls, which go through the proxy.
const DIRECT_API_URL = process.env.NEXT_PUBLIC_DIRECT_API_URL ?? 'http://localhost:3002';

interface Todo {
  id: string;
  text: string;
}

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${DIRECT_API_URL}/todos`);
  return (await res.json()) as Todo[];
}

export default function DirectPage() {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    fetchTodos()
      .then((list) => {
        setTodos(list);
        setStatus('loaded');
      })
      .catch(() => setStatus('error'));
  }, []);

  // Reads the list back after the write instead of patching local state: that
  // second GET is the one a replay must answer with the post-write list.
  async function addTodo() {
    if (!newText.trim()) return;
    const res = await fetch(`${DIRECT_API_URL}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText }),
    });
    // A rejected add keeps the text in the input and the list as it was.
    if (!res.ok) return;
    setNewText('');
    setTodos(await fetchTodos());
  }

  return (
    <div className="container">
      <h1>Direct API</h1>
      <p data-testid="direct-status">{status}</p>

      <div className="card">
        <div className="form-row">
          <input
            type="text"
            placeholder="Add a new todo..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            data-testid="direct-input"
          />
          <button className="btn-primary" onClick={addTodo} data-testid="direct-add">
            Add
          </button>
        </div>
      </div>

      <div className="card">
        {todos.length === 0 ? (
          <p className="empty">No todos found.</p>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className="todo-item" data-testid="direct-item">
              <span className="todo-text">{todo.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
