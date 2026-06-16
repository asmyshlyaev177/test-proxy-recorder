'use client';

import { useState } from 'react';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

// Dev/test: point to the proxy (http://localhost:8100) so browser requests are recorded.
// Production: point to the real backend URL.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100';

export interface TodoAppProps {
  initialTodos: Todo[];
  // The resource path on the backend. Defaults to the public `/todos`; the
  // authenticated examples point this at a protected resource (e.g. `/protected/todos`).
  basePath?: string;
  // Extra headers attached to every request — e.g. `{ authorization: 'Bearer <token>' }`.
  // The recorder redacts the Authorization/Cookie headers from the saved recordings.
  extraHeaders?: Record<string, string>;
}

export default function TodoApp({
  initialTodos,
  basePath = '/todos',
  extraHeaders,
}: TodoAppProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState('');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const filtered = todos.filter((t) =>
    t.text.toLowerCase().includes(filter.toLowerCase()),
  );

  function headers(extra?: Record<string, string>) {
    return { ...extraHeaders, ...extra };
  }

  async function createTodo() {
    if (!newText.trim()) return;
    const res = await fetch(`${API_BASE}${basePath}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text: newText }),
    });
    const todo = (await res.json()) as Todo;
    setTodos((prev) => [...prev, todo]);
    setNewText('');
  }

  async function toggleTodo(id: string, completed: boolean) {
    const res = await fetch(`${API_BASE}${basePath}/${id}`, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ completed: !completed }),
    });
    const updated = (await res.json()) as Todo;
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    const res = await fetch(`${API_BASE}${basePath}/${id}`, {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text: editText }),
    });
    const updated = (await res.json()) as Todo;
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  async function deleteTodo(id: string) {
    await fetch(`${API_BASE}${basePath}/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="container">
      <h1>Todos</h1>

      <div className="card filter-row">
        <input
          type="text"
          placeholder="Filter todos..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="filter-input"
        />
      </div>

      <div className="card">
        <div className="form-row">
          <input
            type="text"
            placeholder="Add a new todo..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTodo()}
            data-testid="new-todo-input"
          />
          <button className="btn-primary" onClick={createTodo} data-testid="add-btn">
            Add
          </button>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <p className="empty">No todos found.</p>
        ) : (
          filtered.map((todo) => (
            <div key={todo.id} className="todo-item" data-testid="todo-item">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id, todo.completed)}
                data-testid="todo-checkbox"
              />
              {editingId === todo.id ? (
                <>
                  <input
                    type="text"
                    className="edit-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(todo.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    data-testid="edit-input"
                  />
                  <div className="todo-actions">
                    <button className="btn-primary" onClick={() => saveEdit(todo.id)} data-testid="save-btn">
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={`todo-text${todo.completed ? ' completed' : ''}`} data-testid="todo-text">
                    {todo.text}
                  </span>
                  <div className="todo-actions">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEditingId(todo.id);
                        setEditText(todo.text);
                      }}
                      data-testid="edit-btn"
                    >
                      Edit
                    </button>
                    <button className="btn-danger" onClick={() => deleteTodo(todo.id)} data-testid="delete-btn">
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
