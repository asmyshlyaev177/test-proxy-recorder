```json title="e2e/recordings/todos__adds-a-todo.mock.json" wrap
{
  "id": "todos__adds-a-todo",
  "recordings": [
    {
      "request": {
        "method": "POST",
        "url": "/todos",
        "headers": {
          "authorization": "[REDACTED]",
          "x-test-rcrd-id": "todos__adds-a-todo"
        },
        "body": "{\"title\":\"Buy groceries\"}"
      },
      "response": {
        "statusCode": 201,
        "body": "{\"id\":7,\"title\":\"Buy groceries\",\"done\":false}"
      },
      "key": "POST_todos.json",
      "sequence": 0
    }
  ]
}
```
