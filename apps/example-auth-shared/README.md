# example-auth-shared

Provider-agnostic **app-runtime** pieces shared by the `example-auth-*` apps.
**Not an app** — it ships source (no build step); consumers transpile it
(`transpilePackages`) or load it directly in Node.

| Export | What |
| ------ | ---- |
| `example-auth-shared/TodoApp` | Protected-resource UI. Optional `basePath` + `extraHeaders` (for the `Authorization` header). |
| `example-auth-shared/globals.css` | Shared styles. |
| `example-auth-shared/mock-backend` | `createMockBackend()` — the application backend: `/protected/todos` (accepts any Bearer token or `session` cookie) plus a mock `/login`. Exports the `MOCK_ACCESS_TOKEN` constant. Runnable directly: `node mock-backend/server.mjs`. |

Deliberately scoped to the above: each app owns **all** of its own e2e code (a
plain `playwright.config.ts`, `setup-auth.ts`, specs, and `assert-redactions.mjs`),
so every example is self-contained and readable on its own.

The per-provider differences live in each app's `proxy.ts` (middleware
composition) and `e2e/setup-auth.ts` (how a session is obtained). See
[ROADMAP.md](./ROADMAP.md) for the multi-provider plan.
