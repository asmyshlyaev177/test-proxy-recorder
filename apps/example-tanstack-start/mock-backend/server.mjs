import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// MOCK_DATA_FILE lets an isolated instance (e.g. an e2e test) use its own store
// instead of sharing the default data/todos.json.
const DATA_FILE =
  process.env.MOCK_DATA_FILE ?? path.join(__dirname, '..', 'data', 'todos.json');
// Protected todos live in their own store so the authenticated dashboard
// (/protected/todos) is independent of the public /todos list.
const PROTECTED_DATA_FILE =
  process.env.PROTECTED_DATA_FILE ??
  path.join(__dirname, '..', 'data', 'protected-todos.json');
const PORT = process.env.MOCK_BACKEND_PORT ?? 3002;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

const readTodos = () => readJson(DATA_FILE);
const writeTodos = (todos) => writeJson(DATA_FILE, todos);
const readProtectedTodos = () => readJson(PROTECTED_DATA_FILE);
const writeProtectedTodos = (todos) => writeJson(PROTECTED_DATA_FILE, todos);

// A request is authenticated if it carries a non-empty Bearer token OR a
// `session` cookie. Provider-agnostic: the backend doesn't verify *who* issued
// the identity — that's the auth provider's job — which is what lets the Cognito
// login record against this same backend. The recorder redacts both mechanisms.
function isAuthed(req) {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && /^Bearer\s+.+/i.test(auth)) return true;
  const cookie = req.headers['cookie'] ?? '';
  return /(?:^|;\s*)session=[^;]+/.test(cookie);
}

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
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/todos') {
      const todos = await readTodos();
      res.writeHead(200);
      res.end(JSON.stringify(todos));
      return;
    }

    // Returns a secret in both a Set-Cookie header and the body, alongside a
    // non-secret `message`. The e2e secret page renders `message` (stable across
    // record/replay), while the recorder must scrub `apiSecret` and the cookie
    // from the saved recordings.
    if (req.method === 'GET' && url.pathname === '/secret') {
      res.setHeader('Set-Cookie', 'session=top-secret-session-value; Path=/; HttpOnly');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, message: 'Secret loaded', apiSecret: 'sk_live_HARSECRET123' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/todos') {
      const body = await getBody(req);
      const { text } = JSON.parse(body);
      const todos = await readTodos();
      const todo = { id: randomUUID(), text, completed: false, createdAt: new Date().toISOString() };
      todos.push(todo);
      await writeTodos(todos);
      res.writeHead(201);
      res.end(JSON.stringify(todo));
      return;
    }

    const idMatch = url.pathname.match(/^\/todos\/([^/]+)$/);

    if (req.method === 'PUT' && idMatch) {
      const id = idMatch[1];
      const body = await getBody(req);
      const updates = JSON.parse(body);
      const todos = await readTodos();
      const idx = todos.findIndex((t) => t.id === id);
      if (idx === -1) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      todos[idx] = { ...todos[idx], ...updates };
      await writeTodos(todos);
      res.writeHead(200);
      res.end(JSON.stringify(todos[idx]));
      return;
    }

    if (req.method === 'DELETE' && idMatch) {
      const id = idMatch[1];
      const todos = await readTodos();
      await writeTodos(todos.filter((t) => t.id !== id));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // DELETE /todos — reset all (used by tests in beforeEach)
    if (req.method === 'DELETE' && url.pathname === '/todos') {
      await writeTodos([]);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // --- Protected application resource (the Cognito-authenticated dashboard) ---
    // Every route here requires a non-empty Bearer token (or session cookie). The
    // dashboard sends the Cognito access token; the recorder redacts it.
    if (
      url.pathname === '/protected/todos' ||
      url.pathname.startsWith('/protected/todos/')
    ) {
      if (!isAuthed(req)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/protected/todos') {
        res.writeHead(200);
        res.end(JSON.stringify(await readProtectedTodos()));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/protected/todos') {
        const { text } = JSON.parse(await getBody(req));
        const todos = await readProtectedTodos();
        const todo = {
          id: randomUUID(),
          text,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        todos.push(todo);
        await writeProtectedTodos(todos);
        res.writeHead(201);
        res.end(JSON.stringify(todo));
        return;
      }

      // DELETE /protected/todos — reset all (used by tests in record mode).
      if (req.method === 'DELETE' && url.pathname === '/protected/todos') {
        await writeProtectedTodos([]);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      const protectedIdMatch = url.pathname.match(
        /^\/protected\/todos\/([^/]+)$/,
      );
      if (protectedIdMatch) {
        const id = protectedIdMatch[1];
        if (req.method === 'PUT') {
          const updates = JSON.parse(await getBody(req));
          const todos = await readProtectedTodos();
          const idx = todos.findIndex((t) => t.id === id);
          if (idx === -1) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }
          todos[idx] = { ...todos[idx], ...updates };
          await writeProtectedTodos(todos);
          res.writeHead(200);
          res.end(JSON.stringify(todos[idx]));
          return;
        }
        if (req.method === 'DELETE') {
          const todos = await readProtectedTodos();
          await writeProtectedTodos(todos.filter((t) => t.id !== id));
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

// WebSocket chat endpoint (ws://localhost:3002/ws/chat)
// Message protocol (JSON):
//   client -> { type: 'chat', text, sentAt? }  server -> { type: 'reply', text: 'Echo: ...', sentAt, serverId }
//   client -> { type: 'burst', count }         server -> count x { type: 'burst-item', index, payload } + { type: 'burst-end', count }
// Negotiates the 'chat-v1' subprotocol — browsers can't set custom headers on
// WebSocket handshakes, so real-world apps pass tokens/versions via the
// Sec-WebSocket-Protocol header; this verifies the proxy forwards and records it
const wss = new WebSocketServer({
  server,
  path: '/ws/chat',
  handleProtocols: (protocols) => (protocols.has('chat-v1') ? 'chat-v1' : false),
});

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'welcome',
      message: 'Connected to chat',
      protocol: socket.protocol || null,
    }),
  );

  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === 'chat') {
      socket.send(
        JSON.stringify({
          type: 'reply',
          text: `Echo: ${msg.text}`,
          sentAt: msg.sentAt ?? null,
          serverId: randomUUID(),
        }),
      );
      return;
    }

    if (msg.type === 'burst') {
      const count = Math.min(msg.count ?? 10, 100);
      for (let i = 0; i < count; i++) {
        socket.send(JSON.stringify({ type: 'burst-item', index: i, payload: `item-${i}` }));
      }
      socket.send(JSON.stringify({ type: 'burst-end', count }));
      return;
    }

    socket.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg?.type}` }));
  });
});

server.listen(PORT, () => {
  console.log(`Mock backend running on http://localhost:${PORT}`);
});
