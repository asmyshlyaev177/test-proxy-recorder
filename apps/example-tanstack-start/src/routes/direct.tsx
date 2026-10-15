import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { createDirectTodo } from '~/lib/api';
import { directTodosQueryOptions } from '~/queries';

export const Route = createFileRoute('/direct')({
  component: DirectPage,
});

const STATUS_LABEL = {
  pending: 'loading',
  error: 'error',
  success: 'loaded',
} as const;

function DirectPage() {
  const queryClient = useQueryClient();
  // No loader prefetch: the list is read in the browser, straight from the API
  // (see the direct section of src/lib/api.ts).
  const { data: todos = [], status } = useQuery(directTodosQueryOptions);
  const [newText, setNewText] = useState('');

  // Re-reads the list after the write instead of patching the cache as TodoApp
  // does: that second GET is the one a replay must answer with the post-write list.
  const createMutation = useMutation({
    mutationFn: createDirectTodo,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: directTodosQueryOptions.queryKey }),
  });

  function addTodo() {
    if (!newText.trim()) return;
    createMutation.mutate(newText);
    setNewText('');
  }

  return (
    <div className="container">
      <h1>Direct API</h1>
      <p data-testid="direct-status">{STATUS_LABEL[status]}</p>

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
