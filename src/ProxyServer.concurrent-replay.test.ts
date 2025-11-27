import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { ProxyServer } from './ProxyServer.js';
import { loadRecordingSession } from './utils/fileUtils.js';

const TEST_RECORDINGS_DIR = path.join(
  process.cwd(),
  'test-recordings-concurrent',
);
const PROXY_PORT = 9883;
const MOCK_SERVER_PORT = 9884;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

describe('ProxyServer Concurrent Replay', () => {
  let proxyServer: ProxyServer;
  let proxyHttpServer: http.Server | null = null;
  let mockServer: http.Server | null = null;

  beforeAll(async () => {
    // Create mock backend server
    mockServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');

        // Simulate different backend responses based on URL
        switch (req.url) {
          case '/api/test': {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ message: 'test response', requestBody: body }),
            );
            break;
          }
          case '/api/users': {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ users: ['user1', 'user2'] }));
            break;
          }
          case '/api/posts': {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ posts: ['post1', 'post2'] }));
            break;
          }
          default: {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        }
      });
    });

    await new Promise<void>((resolve) => {
      mockServer!.listen(MOCK_SERVER_PORT, () => {
        console.log(`Mock server started on port ${MOCK_SERVER_PORT}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer!.close(() => resolve());
      });
    }
  });

  beforeEach(async () => {
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_RECORDINGS_DIR, { recursive: true });

    proxyServer = new ProxyServer([MOCK_SERVER_URL], TEST_RECORDINGS_DIR);
    proxyHttpServer = proxyServer.listen(PROXY_PORT);

    await new Promise<void>((resolve) => {
      proxyHttpServer!.once('listening', () => resolve());
    });
  });

  afterEach(async () => {
    if (proxyHttpServer) {
      await new Promise<void>((resolve) => {
        proxyHttpServer!.close(() => resolve());
      });
      proxyHttpServer = null;
    }

    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
  });

  const setMode = async (mode: string, id: string): Promise<Response> => {
    return fetch(`http://localhost:${PROXY_PORT}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, id }),
    });
  };

  const makeRequest = async (
    path: string,
    options?: {
      method?: string;
      body?: string;
      cookie?: string;
    },
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    };

    if (options?.cookie) {
      headers.Cookie = options.cookie;
    }

    return fetch(`http://localhost:${PROXY_PORT}${path}`, {
      method: options?.method || 'GET',
      headers,
      body: options?.body,
    });
  };

  describe('Cookie-based session routing', () => {
    it('should set cookie when switching to replay mode', async () => {
      const response = await setMode('replay', 'test-session-1');
      expect(response.status).toBe(200);

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('proxy-recording-id=test-session-1');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('should not set cookie for transparent mode', async () => {
      const response = await setMode('transparent', '');
      expect(response.status).toBe(200);

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });

    it('should not set cookie for record mode', async () => {
      const response = await setMode('record', 'test-recording');
      expect(response.status).toBe(200);

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });
  });

  describe('Concurrent replay sessions', () => {
    it('should support two concurrent replay sessions', async () => {
      // Record session 1
      await setMode('record', 'session-1');
      await makeRequest('/api/users');
      await setMode('transparent', '');

      // Record session 2
      await setMode('record', 'session-2');
      await makeRequest('/api/posts');
      await setMode('transparent', '');

      // Verify recordings were created
      const session1 = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, 'session-1.mock.json'),
      );
      const session2 = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, 'session-2.mock.json'),
      );

      expect(session1.recordings).toHaveLength(1);
      expect(session1.recordings[0].request.url).toBe('/api/users');
      expect(session2.recordings).toHaveLength(1);
      expect(session2.recordings[0].request.url).toBe('/api/posts');

      // Start replay for session 1
      const replay1Response = await setMode('replay', 'session-1');
      const cookie1 = replay1Response.headers.get('set-cookie')!;

      // Start replay for session 2
      const replay2Response = await setMode('replay', 'session-2');
      const cookie2 = replay2Response.headers.get('set-cookie')!;

      // Make concurrent requests with different cookies
      const [response1, response2] = await Promise.all([
        makeRequest('/api/users', { cookie: cookie1 }),
        makeRequest('/api/posts', { cookie: cookie2 }),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const data1 = (await response1.json()) as { users: string[] };
      const data2 = (await response2.json()) as { posts: string[] };

      expect(data1.users).toEqual(['user1', 'user2']);
      expect(data2.posts).toEqual(['post1', 'post2']);
    });

    it('should maintain separate state for each session', async () => {
      // Record session 1 with multiple requests to same endpoint
      await setMode('record', 'multi-session-1');
      await makeRequest('/api/test');
      await makeRequest('/api/test');
      await setMode('transparent', '');

      // Record session 2 with multiple requests to same endpoint
      await setMode('record', 'multi-session-2');
      await makeRequest('/api/test');
      await makeRequest('/api/test');
      await makeRequest('/api/test');
      await setMode('transparent', '');

      // Start replay for both sessions
      const replay1Response = await setMode('replay', 'multi-session-1');
      const cookie1 = replay1Response.headers.get('set-cookie')!;

      const replay2Response = await setMode('replay', 'multi-session-2');
      const cookie2 = replay2Response.headers.get('set-cookie')!;

      // Make requests to session 1 (should serve 2 responses)
      const session1Req1 = await makeRequest('/api/test', { cookie: cookie1 });
      const session1Req2 = await makeRequest('/api/test', { cookie: cookie1 });

      expect(session1Req1.status).toBe(200);
      expect(session1Req2.status).toBe(200);

      // Make requests to session 2 (should serve 3 responses)
      const session2Req1 = await makeRequest('/api/test', { cookie: cookie2 });
      const session2Req2 = await makeRequest('/api/test', { cookie: cookie2 });
      const session2Req3 = await makeRequest('/api/test', { cookie: cookie2 });

      expect(session2Req1.status).toBe(200);
      expect(session2Req2.status).toBe(200);
      expect(session2Req3.status).toBe(200);
    });

    it('should handle three or more concurrent sessions', async () => {
      // Record three different sessions
      const sessions = ['session-a', 'session-b', 'session-c'];
      const endpoints = ['/api/users', '/api/posts', '/api/test'];

      for (const [i, session] of sessions.entries()) {
        await setMode('record', session);
        await makeRequest(endpoints[i]);
        await setMode('transparent', '');
      }

      // Start replay for all sessions and collect cookies
      const cookies: string[] = [];
      for (const session of sessions) {
        const response = await setMode('replay', session);
        cookies.push(response.headers.get('set-cookie')!);
      }

      // Make concurrent requests with different cookies
      const responses = await Promise.all([
        makeRequest(endpoints[0], { cookie: cookies[0] }),
        makeRequest(endpoints[1], { cookie: cookies[1] }),
        makeRequest(endpoints[2], { cookie: cookies[2] }),
      ]);

      // All should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Same endpoint, different sessions', () => {
    it('should serve different responses for same endpoint in different sessions', async () => {
      // Record session 1 - GET /api/test returns response A
      await setMode('record', 'same-endpoint-1');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ session: 'session-1' }),
      });
      await setMode('transparent', '');

      // Record session 2 - GET /api/test returns response B
      await setMode('record', 'same-endpoint-2');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ session: 'session-2' }),
      });
      await setMode('transparent', '');

      // Verify recordings have different responses
      const session1 = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, 'same-endpoint-1.mock.json'),
      );
      const session2 = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, 'same-endpoint-2.mock.json'),
      );

      expect(session1.recordings[0].request.url).toBe('/api/test');
      expect(session2.recordings[0].request.url).toBe('/api/test');
      expect(session1.recordings[0].request.body).toContain('session-1');
      expect(session2.recordings[0].request.body).toContain('session-2');

      // Start replay for both sessions
      const replay1Response = await setMode('replay', 'same-endpoint-1');
      const cookie1 = replay1Response.headers.get('set-cookie')!;

      const replay2Response = await setMode('replay', 'same-endpoint-2');
      const cookie2 = replay2Response.headers.get('set-cookie')!;

      // Make concurrent requests to SAME endpoint with different cookies
      const [response1, response2] = await Promise.all([
        makeRequest('/api/test', { method: 'POST', cookie: cookie1 }),
        makeRequest('/api/test', { method: 'POST', cookie: cookie2 }),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const data1 = (await response1.json()) as { requestBody: string };
      const data2 = (await response2.json()) as { requestBody: string };

      // Verify each session got its own recorded response
      expect(JSON.parse(data1.requestBody).session).toBe('session-1');
      expect(JSON.parse(data2.requestBody).session).toBe('session-2');
    });

    it('should handle multiple requests to same endpoint in concurrent sessions', async () => {
      // Record session 1 - multiple requests to /api/data
      await setMode('record', 'multi-same-1');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ request: 1, session: 'A' }),
      });
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ request: 2, session: 'A' }),
      });
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ request: 3, session: 'A' }),
      });
      await setMode('transparent', '');

      // Record session 2 - multiple requests to /api/data
      await setMode('record', 'multi-same-2');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ request: 1, session: 'B' }),
      });
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ request: 2, session: 'B' }),
      });
      await setMode('transparent', '');

      // Start replay for both
      const replay1 = await setMode('replay', 'multi-same-1');
      const cookie1 = replay1.headers.get('set-cookie')!;

      const replay2 = await setMode('replay', 'multi-same-2');
      const cookie2 = replay2.headers.get('set-cookie')!;

      // Make requests sequentially per session to ensure deterministic order
      // Session 1 makes 3 requests
      const session1Req1 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie1,
      });
      const session1Req2 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie1,
      });
      const session1Req3 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie1,
      });

      // Session 2 makes 2 requests
      const session2Req1 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie2,
      });
      const session2Req2 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie2,
      });

      // All should succeed
      expect(session1Req1.status).toBe(200);
      expect(session1Req2.status).toBe(200);
      expect(session1Req3.status).toBe(200);
      expect(session2Req1.status).toBe(200);
      expect(session2Req2.status).toBe(200);

      // Verify session 1 got responses in order
      const session1Data1 = (await session1Req1.json()) as {
        requestBody: string;
      };
      const session1Data2 = (await session1Req2.json()) as {
        requestBody: string;
      };
      const session1Data3 = (await session1Req3.json()) as {
        requestBody: string;
      };

      expect(JSON.parse(session1Data1.requestBody).request).toBe(1);
      expect(JSON.parse(session1Data1.requestBody).session).toBe('A');
      expect(JSON.parse(session1Data2.requestBody).request).toBe(2);
      expect(JSON.parse(session1Data2.requestBody).session).toBe('A');
      expect(JSON.parse(session1Data3.requestBody).request).toBe(3);
      expect(JSON.parse(session1Data3.requestBody).session).toBe('A');

      // Verify session 2 got responses in order
      const session2Data1 = (await session2Req1.json()) as {
        requestBody: string;
      };
      const session2Data2 = (await session2Req2.json()) as {
        requestBody: string;
      };

      expect(JSON.parse(session2Data1.requestBody).request).toBe(1);
      expect(JSON.parse(session2Data1.requestBody).session).toBe('B');
      expect(JSON.parse(session2Data2.requestBody).request).toBe(2);
      expect(JSON.parse(session2Data2.requestBody).session).toBe('B');
    });

    it('should maintain correct order when sessions interleave requests', async () => {
      // Record session 1
      await setMode('record', 'interleave-1');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ order: 'first', session: 'X' }),
      });
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ order: 'second', session: 'X' }),
      });
      await setMode('transparent', '');

      // Record session 2
      await setMode('record', 'interleave-2');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ order: 'first', session: 'Y' }),
      });
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ order: 'second', session: 'Y' }),
      });
      await setMode('transparent', '');

      // Start replay
      const replay1 = await setMode('replay', 'interleave-1');
      const cookie1 = replay1.headers.get('set-cookie')!;

      const replay2 = await setMode('replay', 'interleave-2');
      const cookie2 = replay2.headers.get('set-cookie')!;

      // Interleave requests: S1-R1, S2-R1, S1-R2, S2-R2
      const r1_1 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie1,
      });
      const r2_1 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie2,
      });
      const r1_2 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie1,
      });
      const r2_2 = await makeRequest('/api/test', {
        method: 'POST',
        cookie: cookie2,
      });

      // Verify each session maintained its own order
      const data1_1 = (await r1_1.json()) as { requestBody: string };
      const data2_1 = (await r2_1.json()) as { requestBody: string };
      const data1_2 = (await r1_2.json()) as { requestBody: string };
      const data2_2 = (await r2_2.json()) as { requestBody: string };

      expect(JSON.parse(data1_1.requestBody).order).toBe('first');
      expect(JSON.parse(data1_1.requestBody).session).toBe('X');
      expect(JSON.parse(data1_2.requestBody).order).toBe('second');
      expect(JSON.parse(data1_2.requestBody).session).toBe('X');

      expect(JSON.parse(data2_1.requestBody).order).toBe('first');
      expect(JSON.parse(data2_1.requestBody).session).toBe('Y');
      expect(JSON.parse(data2_2.requestBody).order).toBe('second');
      expect(JSON.parse(data2_2.requestBody).session).toBe('Y');
    });
  });

  describe('Error handling', () => {
    it('should return 404 when recording not found for concurrent session', async () => {
      // Start replay for non-existent session
      const replayResponse = await setMode('replay', 'non-existent');
      const cookie = replayResponse.headers.get('set-cookie')!;

      // Make request with cookie
      const response = await makeRequest('/api/users', { cookie });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain('Recording file not found');
    });

    it('should return 404 when endpoint not recorded in concurrent session', async () => {
      // Record session with only /api/users
      await setMode('record', 'partial-session');
      await makeRequest('/api/users');
      await setMode('transparent', '');

      // Start replay
      const replayResponse = await setMode('replay', 'partial-session');
      const cookie = replayResponse.headers.get('set-cookie')!;

      // Try to access unrecorded endpoint
      const response = await makeRequest('/api/posts', { cookie });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe('No recording found');
    });
  });

  describe('Session isolation', () => {
    it('should not mix responses between sessions', async () => {
      // Record session 1 with specific response
      await setMode('record', 'isolation-1');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'session-1' }),
      });
      await setMode('transparent', '');

      // Record session 2 with different response
      await setMode('record', 'isolation-2');
      await makeRequest('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'session-2' }),
      });
      await setMode('transparent', '');

      // Start replay for both
      const replay1 = await setMode('replay', 'isolation-1');
      const cookie1 = replay1.headers.get('set-cookie')!;

      const replay2 = await setMode('replay', 'isolation-2');
      const cookie2 = replay2.headers.get('set-cookie')!;

      const [response1, response2] = await Promise.all([
        makeRequest('/api/test', {
          method: 'POST',
          cookie: cookie1,
        }),
        makeRequest('/api/test', {
          method: 'POST',
          cookie: cookie2,
        }),
      ]);

      const data1 = (await response1.json()) as {
        requestBody: string;
      };
      const data2 = (await response2.json()) as {
        requestBody: string;
      };

      expect(JSON.parse(data1.requestBody).data).toBe('session-1');
      expect(JSON.parse(data2.requestBody).data).toBe('session-2');
    });
  });
});
