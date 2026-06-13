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
const PORT = process.env.MOCK_BACKEND_PORT ?? 3002;

async function readTodos() {
  try {
    const content = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeTodos(todos) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(todos, null, 2));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-test-rcrd-id');
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
