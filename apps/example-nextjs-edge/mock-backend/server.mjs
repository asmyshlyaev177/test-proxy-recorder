import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// MOCK_DATA_FILE lets an isolated instance use its own store instead of the
// shared data/todos.json.
const DATA_FILE =
  process.env.MOCK_DATA_FILE ?? path.join(__dirname, '..', 'data', 'todos.json');
const PORT = process.env.MOCK_BACKEND_PORT ?? 3012;

async function readTodos() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf-8'));
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-test-rcrd-id');
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
      res.writeHead(200);
      res.end(JSON.stringify(await readTodos()));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/todos') {
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

    // DELETE /todos — reset all (used by tests in record mode)
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

server.listen(PORT, () => {
  console.log(`Mock backend running on http://localhost:${PORT}`);
});
