export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

// Pure server-rendered list. There is no client-side fetching in this example —
// the whole point is to exercise the *server-side* (edge runtime) fetch that
// goes through the proxy, where attributing a request to a recording session is
// the hard part.
export default function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <div className="container">
      <h1>Edge Todos</h1>
      <div className="card">
        {todos.length === 0 ? (
          <p className="empty" data-testid="empty">
            No todos found.
          </p>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className="todo-item" data-testid="todo-item">
              <span className="todo-text" data-testid="todo-text">
                {todo.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
