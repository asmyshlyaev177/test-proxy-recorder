import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

// Shared "application backend" for the example-auth-* apps.
//
// It exposes a PROTECTED todo resource (`/protected/todos`) plus a mock identity
// endpoint (`/login`). The protected routes are deliberately *provider-agnostic*:
// they accept ANY non-empty Bearer token or `session` cookie. They don't verify
// who issued the identity — that's the job of the auth provider in front of the
// app. This is what lets every provider example (mock, cognito, clerk, …) record
// against the same backend; only the way a token is OBTAINED differs per app.

// Fixed credentials + token for the MOCK identity provider (example-auth-mock).
// The token is intentionally a constant so the redaction guard can assert it
// never leaks into a recording. Real-provider apps don't use `/login` at all.
export const TEST_USER = { email: 'test@example.com', password: 'Password123' };
export const MOCK_ACCESS_TOKEN = 'mock-access-token-7f3b2a91c4';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-test-rcrd-id',
  );
  res.setHeader('Content-Type', 'application/json');
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// A request is authenticated if it carries a non-empty Bearer token OR a
// `session` cookie. Demonstrates "both" mechanisms; the recorder redacts both.
function isAuthed(req) {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && /^Bearer\s+.+/i.test(auth)) return true;
  const cookie = req.headers['cookie'] ?? '';
  return /(?:^|;\s*)session=[^;]+/.test(cookie);
}

/**
 * Create the shared mock backend HTTP server (not yet listening).
 * @param {object} [opts]
 * @param {string} [opts.dataFile] Where protected todos are persisted.
 *   Defaults to env PROTECTED_DATA_FILE, else <cwd>/data/protected-todos.json.
 */
export function createMockBackend(opts = {}) {
  const dataFile =
    opts.dataFile ??
    process.env.PROTECTED_DATA_FILE ??
    path.join(process.cwd(), 'data', 'protected-todos.json');

  async function readTodos() {
    try {
      return JSON.parse(await readFile(dataFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  async function writeTodos(todos) {
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(todos, null, 2));
  }

  return createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    try {
      // --- Mock identity provider (used only by example-auth-mock) ---
      if (req.method === 'POST' && url.pathname === '/login') {
        const { email, password } = JSON.parse((await getBody(req)) || '{}');
        if (email === TEST_USER.email && password === TEST_USER.password) {
          // Both mechanisms at once: an httpOnly session cookie AND a token in
          // the body (the client stores the latter and sends it as a Bearer
          // header on protected calls).
          res.setHeader(
            'Set-Cookie',
            `session=${MOCK_ACCESS_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
          );
          res.writeHead(200);
          res.end(
            JSON.stringify({ token: MOCK_ACCESS_TOKEN, user: { email } }),
          );
          return;
        }
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }

      // --- Protected application resource (every provider example uses this) ---
      if (url.pathname === '/protected/todos' || url.pathname.startsWith('/protected/todos/')) {
        if (!isAuthed(req)) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        if (req.method === 'GET' && url.pathname === '/protected/todos') {
          res.writeHead(200);
          res.end(JSON.stringify(await readTodos()));
          return;
        }

        if (req.method === 'POST' && url.pathname === '/protected/todos') {
          const { text } = JSON.parse(await getBody(req));
          const todos = await readTodos();
          const todo = {
            id: randomUUID(),
            text,
            completed: false,
            createdAt: new Date().toISOString(),
          };
          todos.push(todo);
          await writeTodos(todos);
          res.writeHead(201);
          res.end(JSON.stringify(todo));
          return;
        }

        // DELETE /protected/todos — reset all (used by tests in record mode).
        if (req.method === 'DELETE' && url.pathname === '/protected/todos') {
          await writeTodos([]);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        const idMatch = url.pathname.match(/^\/protected\/todos\/([^/]+)$/);
        if (idMatch) {
          const id = idMatch[1];
          if (req.method === 'PUT') {
            const updates = JSON.parse(await getBody(req));
            const todos = await readTodos();
            const idx = todos.findIndex((t) => t.id === id);
            if (idx === -1) {
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'Not found' }));
              return;
            }
            todos[idx] = { ...todos[idx], ...updates };
            await writeTodos(todos);
            res.writeHead(200);
            res.end(JSON.stringify(todos[idx]));
            return;
          }
          if (req.method === 'DELETE') {
            const todos = await readTodos();
            await writeTodos(todos.filter((t) => t.id !== id));
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      console.error('Mock backend error:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
}

// Allow running directly as a script: `node mock-backend/server.mjs`.
// Detect "is this the entry module" without import.meta.main (not everywhere yet).
const isEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isEntry) {
  const PORT = process.env.MOCK_BACKEND_PORT ?? 3102;
  createMockBackend().listen(PORT, () => {
    console.log(`Mock auth backend running on http://localhost:${PORT}`);
  });
}
