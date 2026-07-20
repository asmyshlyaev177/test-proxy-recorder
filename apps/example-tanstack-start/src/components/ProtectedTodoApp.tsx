import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import {
  createProtectedTodo,
  deleteProtectedTodo,
  type Todo,
  updateProtectedTodo,
} from '~/lib/api';
import { protectedTodosQueryOptions } from '~/queries';

// The authenticated dashboard's todo UI. Same TanStack Query idioms as the public
// <TodoApp>, but every request carries the Cognito Bearer `token` and hits the
// PROTECTED resource. Because the token is client-only, this uses `useQuery`
// (fetched on mount, recorded via HAR) rather than the SSR-prefetched
// `useSuspenseQuery` of the home page.
export function ProtectedTodoApp({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const options = protectedTodosQueryOptions(token);
  const { data: todos = [], status } = useQuery(options);

  const [filter, setFilter] = useState('');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Patch the cache from each mutation's response instead of refetching, so the
  // recorded network is exactly one GET + the mutation calls — deterministic to replay.
  const patchTodos = (updater: (old: Todo[]) => Todo[]) =>
    queryClient.setQueryData(options.queryKey, (old) => updater(old ?? []));

  const createMutation = useMutation({
    mutationFn: (text: string) => createProtectedTodo(token, text),
    onSuccess: (todo) => patchTodos((old) => [...old, todo]),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; updates: Partial<Todo> }) =>
      updateProtectedTodo(token, vars.id, vars.updates),
    onSuccess: (todo) =>
      patchTodos((old) => old.map((t) => (t.id === todo.id ? todo : t))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProtectedTodo(token, id),
    onSuccess: (_result, id) =>
      patchTodos((old) => old.filter((t) => t.id !== id)),
  });

  if (status === 'pending') {
    return (
      <div className="container">
        <p className="empty" data-testid="protected-status">
          Loading protected todos…
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container">
        <p className="empty" data-testid="protected-status">
          Failed to load protected todos.
        </p>
      </div>
    );
  }

  const filtered = todos.filter((t) =>
    t.text.toLowerCase().includes(filter.toLowerCase()),
  );

  function addTodo() {
    if (!newText.trim()) return;
    createMutation.mutate(newText);
    setNewText('');
  }

  function saveEdit(id: string) {
    if (!editText.trim()) return;
    updateMutation.mutate(
      { id, updates: { text: editText } },
      { onSuccess: () => setEditingId(null) },
    );
  }

  return (
    <div className="container">
      <h1>Protected Todos</h1>

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
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            data-testid="new-todo-input"
          />
          <button className="btn-primary" onClick={addTodo} data-testid="add-btn">
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
                onChange={() =>
                  updateMutation.mutate({
                    id: todo.id,
                    updates: { completed: !todo.completed },
                  })
                }
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
                    <button
                      className="btn-primary"
                      onClick={() => saveEdit(todo.id)}
                      data-testid="save-btn"
                    >
                      Save
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={`todo-text${todo.completed ? ' completed' : ''}`}
                    data-testid="todo-text"
                  >
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
                    <button
                      className="btn-danger"
                      onClick={() => deleteMutation.mutate(todo.id)}
                      data-testid="delete-btn"
                    >
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
