/* eslint-disable unicorn/consistent-function-scoping */
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
  'test-recordings-edge-cases',
);
const PROXY_PORT = 9879;
const MOCK_SERVER_PORT = 9880;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

describe('ProxyServer Recording Edge Cases', () => {
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

        // Simulate different backend responses
        switch (req.url) {
          case '/api/test': {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({ message: 'test response', requestBody: body }),
            );

            break;
          }
          case '/api/users/me': {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: '123', name: 'Test User' }));

            break;
          }
          case '/api/slow': {
            // Simulate slow response
            setTimeout(() => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: 'slow response' }));
            }, 100);

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

  const setMode = async (mode: string, id: string): Promise<void> => {
    await fetch(`http://localhost:${PROXY_PORT}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, id }),
    });
  };

  const makeRequest = async (
    path: string,
    method = 'GET',
    body?: string,
  ): Promise<Response> => {
    return fetch(`http://localhost:${PROXY_PORT}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body,
    });
  };

  describe('Normal recording flow', () => {
    it('should record request and response correctly', async () => {
      const sessionId = 'test-normal-flow';
      await setMode('record', sessionId);

      const response = await makeRequest('/api/test');
      expect(response.status).toBe(200);

      const data = (await response.json()) as { message: string };
      expect(data.message).toBe('test response');

      // Switch back to transparent to save
      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(1);
      expect(session.recordings[0].request.url).toBe('/api/test');
      expect(session.recordings[0].response).toBeDefined();
      expect(session.recordings[0].response?.statusCode).toBe(200);
    });
  });

  describe('Multiple requests to same endpoint', () => {
    it('should record multiple sequential requests with different sequence numbers', async () => {
      const sessionId = 'test-multiple-sequential';
      await setMode('record', sessionId);

      // Make 3 requests to same endpoint
      const response1 = await makeRequest('/api/test');
      expect(response1.status).toBe(200);

      const response2 = await makeRequest('/api/test');
      expect(response2.status).toBe(200);

      const response3 = await makeRequest('/api/test');
      expect(response3.status).toBe(200);

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(3);

      // All should have responses
      for (const recording of session.recordings) {
        expect(recording.response).toBeDefined();
        expect(recording.response?.statusCode).toBe(200);
      }
    });

    it('should record concurrent requests to same endpoint', async () => {
      const sessionId = 'test-concurrent-requests';
      await setMode('record', sessionId);

      // Make concurrent requests
      const promises = [
        makeRequest('/api/test'),
        makeRequest('/api/test'),
        makeRequest('/api/test'),
      ];

      const responses = await Promise.all(promises);
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(3);

      // All should have responses
      for (const recording of session.recordings) {
        expect(recording.response).toBeDefined();
        expect(recording.response?.statusCode).toBe(200);
      }
    });
  });

  describe('Different HTTP methods to same URL', () => {
    it('should record GET and POST to same URL with different keys', async () => {
      const sessionId = 'test-different-methods';
      await setMode('record', sessionId);

      const getResponse = await makeRequest('/api/test', 'GET');
      expect(getResponse.status).toBe(200);

      const postResponse = await makeRequest(
        '/api/test',
        'POST',
        JSON.stringify({ data: 'test' }),
      );
      expect(postResponse.status).toBe(200);

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(2);

      const getRecording = session.recordings.find(
        (r) => r.request.method === 'GET',
      );
      const postRecording = session.recordings.find(
        (r) => r.request.method === 'POST',
      );

      expect(getRecording).toBeDefined();
      expect(postRecording).toBeDefined();
      expect(getRecording?.response).toBeDefined();
      expect(postRecording?.response).toBeDefined();

      // Keys should be different
      expect(getRecording?.key).not.toBe(postRecording?.key);
    });
  });

  describe('Request with body', () => {
    it('should record POST request with body correctly', async () => {
      const sessionId = 'test-post-with-body';
      await setMode('record', sessionId);

      const requestBody = JSON.stringify({
        title: 'Test Post',
        content: 'Test content',
      });
      const response = await makeRequest('/api/test', 'POST', requestBody);
      expect(response.status).toBe(200);

      const responseData = (await response.json()) as { requestBody: string };
      expect(responseData.requestBody).toBe(requestBody);

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(1);
      expect(session.recordings[0].request.body).toBe(requestBody);
      expect(session.recordings[0].response).toBeDefined();
    });
  });

  describe('Slow responses', () => {
    it('should handle slow backend responses correctly', async () => {
      const sessionId = 'test-slow-response';
      await setMode('record', sessionId);

      const response = await makeRequest('/api/slow');
      expect(response.status).toBe(200);

      const data = (await response.json()) as { message: string };
      expect(data.message).toBe('slow response');

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(1);
      expect(session.recordings[0].response).toBeDefined();
      expect(session.recordings[0].response?.statusCode).toBe(200);
    });
  });

  describe('Mixed requests', () => {
    it('should record multiple different endpoints correctly', async () => {
      const sessionId = 'test-mixed-requests';
      await setMode('record', sessionId);

      const responses = await Promise.all([
        makeRequest('/api/test'),
        makeRequest('/api/users/me'),
        makeRequest('/api/test', 'POST', JSON.stringify({ data: 'test' })),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      await setMode('transparent', '');

      // Verify recording
      const session = await loadRecordingSession(
        path.join(TEST_RECORDINGS_DIR, `${sessionId}.mock.json`),
      );

      expect(session.recordings).toHaveLength(3);

      // All should have responses
      for (const recording of session.recordings) {
        expect(recording.response).toBeDefined();
        expect(recording.response?.statusCode).toBe(200);
      }

      // Verify different keys
      const keys = session.recordings.map((r) => r.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(3); // All keys should be unique
    });
  });

  describe('Replay mode', () => {
    it('should replay recorded responses correctly', async () => {
      const sessionId = 'test-replay';

      // First, record
      await setMode('record', sessionId);
      const recordResponse = await makeRequest('/api/test');
      expect(recordResponse.status).toBe(200);
      await setMode('transparent', '');

      // Now replay
      await setMode('replay', sessionId);
      const replayResponse = await makeRequest('/api/test');
      expect(replayResponse.status).toBe(200);

      const data = (await replayResponse.json()) as { message: string };
      expect(data.message).toBe('test response');

      await setMode('transparent', '');
    });

    it('should replay multiple requests to same endpoint in sequence', async () => {
      const sessionId = 'test-replay-multiple';

      // Record 3 requests
      await setMode('record', sessionId);
      await makeRequest('/api/test');
      await makeRequest('/api/test');
      await makeRequest('/api/test');
      await setMode('transparent', '');

      // Replay 3 requests
      await setMode('replay', sessionId);
      const response1 = await makeRequest('/api/test');
      const response2 = await makeRequest('/api/test');
      const response3 = await makeRequest('/api/test');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);

      await setMode('transparent', '');
    });
  });
});
