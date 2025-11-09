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

const TEST_RECORDINGS_DIR = path.join(
  process.cwd(),
  'test-recordings-integration',
);
const PROXY_PORT = 9877;
const MOCK_SERVER_PORT = 9878;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

describe('ProxyServer Integration Tests', () => {
  let proxyServer: ProxyServer;
  let proxyHttpServer: http.Server | null = null;
  let mockServer: http.Server | null = null;
  const mockResponses: Map<string, MockResponse> = new Map();
  let backendRequestCount = 0;

  beforeAll(async () => {
    // Create mock backend server
    mockServer = http.createServer((req, res) => {
      backendRequestCount++;

      const key = `${req.method}:${req.url}`;
      const mockResponse = mockResponses.get(key);

      if (!mockResponse) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Collect request body (not used in mock but consumed from stream)
      req.on('data', () => {
        // Body consumed but not used in mock responses
      });

      req.on('end', () => {
        res.writeHead(mockResponse.statusCode, mockResponse.headers);
        res.end(mockResponse.body);
      });
    });

    await new Promise<void>((resolve) => {
      mockServer!.listen(MOCK_SERVER_PORT, () => {
        console.log(`Mock server listening on port ${MOCK_SERVER_PORT}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer!.close(() => resolve());
      });
      mockServer = null;
    }
  });

  beforeEach(async () => {
    // Clean up test recordings directory
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });

    // Reset mock responses and backend request counter
    mockResponses.clear();
    backendRequestCount = 0;

    // Create and start proxy server
    proxyServer = new ProxyServer([MOCK_SERVER_URL], TEST_RECORDINGS_DIR);
    await proxyServer.init();
    proxyHttpServer = proxyServer.listen(PROXY_PORT);

    await new Promise<void>((resolve) => {
      proxyHttpServer!.on('listening', () => resolve());
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

  describe('Transparent Mode', () => {
    it('should proxy GET requests to backend', async () => {
      const mockData = { users: ['Alice', 'Bob'] };
      const mockDataJson = JSON.stringify(mockData);

      mockResponses.set('GET:/api/users', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: mockDataJson,
      });

      const response = await makeProxyRequest('GET', '/api/users');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.body).toBe(mockDataJson);
    });

    it('should proxy POST requests with body', async () => {
      const requestData = { name: 'Charlie' };
      const responseData = { id: 123, name: 'Charlie' };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('POST:/api/users', {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      const response = await makeProxyRequest('POST', '/api/users', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toBe(responseDataJson);
    });

    it('should handle 404 responses', async () => {
      const response = await makeProxyRequest('GET', '/api/nonexistent');

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('Not found');
    });

    it('should preserve response headers', async () => {
      const mockData = { test: true };
      const customHeaderValue = 'test-value';
      const cacheControlValue = 'no-cache';

      mockResponses.set('GET:/api/test', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': customHeaderValue,
          'Cache-Control': cacheControlValue,
        },
        body: JSON.stringify(mockData),
      });

      const response = await makeProxyRequest('GET', '/api/test');

      expect(response.headers['x-custom-header']).toBe(customHeaderValue);
      expect(response.headers['cache-control']).toBe(cacheControlValue);
    });
  });

  describe('Record Mode', () => {
    const sessionId = 'test-recording-session';

    beforeEach(async () => {
      await setProxyMode('record', sessionId);
    });

    it('should record GET request and response', async () => {
      const mockData = { data: 'test' };
      const mockDataJson = JSON.stringify(mockData);

      mockResponses.set('GET:/api/data', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: mockDataJson,
      });

      const response = await makeProxyRequest('GET', '/api/data');

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(mockDataJson);

      // Switch back to transparent to save recording
      await setProxyMode('transparent', sessionId);

      // Verify recording file was created
      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.id).toBe(sessionId);
      expect(recording.recordings).toHaveLength(1);
      expect(recording.recordings[0].request.method).toBe('GET');
      expect(recording.recordings[0].request.url).toBe('/api/data');
      expect(recording.recordings[0].response.statusCode).toBe(200);
      expect(recording.recordings[0].response.body).toBe(mockDataJson);
    });

    it('should record POST request with body', async () => {
      const requestData = { name: 'Test' };
      const responseData = { id: 456 };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('POST:/api/create', {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      await makeProxyRequest('POST', '/api/create', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.method).toBe('POST');
      expect(recording.recordings[0].request.body).toBe(requestDataJson);
      expect(recording.recordings[0].response.statusCode).toBe(201);
    });

    it('should record multiple requests', async () => {
      const usersData = { users: [] };
      const postsData = { posts: [] };

      mockResponses.set('GET:/api/users', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersData),
      });

      mockResponses.set('GET:/api/posts', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postsData),
      });

      await makeProxyRequest('GET', '/api/users');
      await makeProxyRequest('GET', '/api/posts');

      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings).toHaveLength(2);
      expect(recording.recordings[0].request.url).toBe('/api/users');
      expect(recording.recordings[1].request.url).toBe('/api/posts');
    });

    it('should record requests with query parameters', async () => {
      const searchUrl = '/api/search?q=test&page=1';
      const resultsData = { results: [] };

      mockResponses.set(`GET:${searchUrl}`, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultsData),
      });

      await makeProxyRequest('GET', searchUrl);
      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.url).toBe(searchUrl);
    });
  });

  describe('Replay Mode', () => {
    const sessionId = 'test-replay-session';
    const replayGetData = { replayed: true, data: 'from-recording' };
    const replayPostRequestData = { name: 'Test' };
    const replayPostResponseData = { id: 999, created: true };

    beforeEach(async () => {
      // Create a recording first
      const recording = {
        id: sessionId,
        recordings: [
          {
            key: 'GET_api_data.json',
            sequence: 0,
            request: {
              method: 'GET',
              url: '/api/data',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayGetData),
            },
            timestamp: new Date().toISOString(),
          },
          {
            key: 'POST_api_create.json',
            sequence: 0,
            request: {
              method: 'POST',
              url: '/api/create',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPostRequestData),
            },
            response: {
              statusCode: 201,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPostResponseData),
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2));
    });

    it('should replay GET request from record', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('GET', '/api/data');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.body).toBe(JSON.stringify(replayGetData));
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });

    it('should replay POST request from record', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('POST', '/api/create', {
        body: JSON.stringify(replayPostRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toBe(JSON.stringify(replayPostResponseData));
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });

    it('should return 404 when recording not found', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('GET', '/api/nonexistent');

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('Recording not found');
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called even for 404
    });

    it('should return 404 when recording file does not exist', async () => {
      const initialRequestCount = backendRequestCount;
      const nonexistentSession = 'nonexistent-session';
      await setProxyMode('replay', nonexistentSession);

      const response = await makeProxyRequest('GET', '/api/data');

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('Recording file not found');
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });

    it('should not hit backend server in replay mode', async () => {
      const initialRequestCount = backendRequestCount;

      await setProxyMode('replay', sessionId);
      const response = await makeProxyRequest('GET', '/api/data');

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(JSON.stringify(replayGetData));
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });
  });

  describe('CORS Support in All Modes', () => {
    const testOrigin = 'http://localhost:3000';

    it('should add CORS headers in transparent mode', async () => {
      const mockData = { data: 'test' };

      mockResponses.set('GET:/api/cors-test', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      });

      const response = await makeProxyRequest('GET', '/api/cors-test', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should add CORS headers in record mode', async () => {
      const sessionId = 'cors-record-test';
      const mockData = { recorded: true };

      mockResponses.set('GET:/api/cors-record', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      });

      await setProxyMode('record', sessionId);

      const response = await makeProxyRequest('GET', '/api/cors-record', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');

      await setProxyMode('transparent', sessionId);
    });

    it('should add CORS headers in replay mode', async () => {
      const sessionId = 'cors-replay-test';
      const replayData = { replayed: true };

      // Create recording
      const recording = {
        id: sessionId,
        recordings: [
          {
            key: 'GET_api_cors-replay.json',
            sequence: 0,
            request: {
              method: 'GET',
              url: '/api/cors-replay',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayData),
            },
            timestamp: new Date().toISOString(),
          },
        ],
        websocketRecordings: [],
      };

      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2));

      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('GET', '/api/cors-replay', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.body).toBe(JSON.stringify(replayData));
    });

    it('should handle OPTIONS preflight in transparent mode', async () => {
      const response = await makeProxyRequest('OPTIONS', '/api/preflight', {
        headers: {
          Origin: testOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type',
      );
      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('should handle OPTIONS preflight without origin', async () => {
      const response = await makeProxyRequest('OPTIONS', '/api/preflight', {
        headers: {
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should preserve backend CORS headers and add proxy CORS headers', async () => {
      const mockData = { test: true };
      const backendCorsHeader = 'X-Backend-CORS';

      mockResponses.set('GET:/api/backend-cors', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          [backendCorsHeader]: 'backend-value',
        },
        body: JSON.stringify(mockData),
      });

      const response = await makeProxyRequest('GET', '/api/backend-cors', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(200);
      // Proxy should add CORS headers
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      // Backend headers should be preserved (case-insensitive)
      expect(response.headers[backendCorsHeader.toLowerCase()]).toBe(
        'backend-value',
      );
    });
  });

  describe('Sequence Handling', () => {
    it('should record and replay multiple requests to same endpoint in correct order', async () => {
      const sessionId = 'multiple-requests-test';

      // Mock endpoint that returns different responses
      mockResponses.set('GET:/api/data', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Response 1', count: 1 }),
      });

      await setProxyMode('record', sessionId);

      // Make 3 requests to the same endpoint
      // Since mock returns same response, we'll update it between requests
      const response1 = await makeProxyRequest('GET', '/api/data');
      expect(response1.statusCode).toBe(200);

      mockResponses.set('GET:/api/data', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Response 2', count: 2 }),
      });
      const response2 = await makeProxyRequest('GET', '/api/data');
      expect(response2.statusCode).toBe(200);

      mockResponses.set('GET:/api/data', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Response 3', count: 3 }),
      });
      const response3 = await makeProxyRequest('GET', '/api/data');
      expect(response3.statusCode).toBe(200);

      await setProxyMode('transparent', sessionId);

      // Verify the recording file has correct sequences
      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const fileContent = await fs.readFile(recordingPath, 'utf8');
      const session = JSON.parse(fileContent);

      expect(session.recordings).toHaveLength(3);
      expect(session.recordings[0].sequence).toBe(0);
      expect(session.recordings[1].sequence).toBe(1);
      expect(session.recordings[2].sequence).toBe(2);

      // All recordings should have the same key
      const key1 = session.recordings[0].key;
      const key2 = session.recordings[1].key;
      const key3 = session.recordings[2].key;
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);

      // Switch to replay mode
      await setProxyMode('replay', sessionId);

      // Replay the requests - they should return in the same order
      const replay1 = await makeProxyRequest('GET', '/api/data');
      const replay2 = await makeProxyRequest('GET', '/api/data');
      const replay3 = await makeProxyRequest('GET', '/api/data');

      expect(JSON.parse(replay1.body).message).toBe('Response 1');
      expect(JSON.parse(replay2.body).message).toBe('Response 2');
      expect(JSON.parse(replay3.body).message).toBe('Response 3');

      await setProxyMode('transparent', sessionId);
    });

    it('should handle replay sequence reset when switching modes', async () => {
      const sessionId = 'sequence-reset-test';

      mockResponses.set('GET:/api/test', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'first' }),
      });

      await setProxyMode('record', sessionId);

      await makeProxyRequest('GET', '/api/test');

      mockResponses.set('GET:/api/test', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'second' }),
      });

      await makeProxyRequest('GET', '/api/test');

      await setProxyMode('transparent', sessionId);

      // Switch to replay mode
      await setProxyMode('replay', sessionId);

      // Replay first request
      const replay1 = await makeProxyRequest('GET', '/api/test');
      expect(JSON.parse(replay1.body).data).toBe('first');

      // Switch back to transparent and then replay again
      await setProxyMode('transparent', sessionId);
      await setProxyMode('replay', sessionId);

      // Should start from sequence 0 again
      const replay2 = await makeProxyRequest('GET', '/api/test');
      expect(JSON.parse(replay2.body).data).toBe('first');

      await setProxyMode('transparent', sessionId);
    });
  });

  describe('Mode Switching', () => {
    it('should switch from transparent to recording to transparent', async () => {
      const sessionId = 'mode-switch-test';
      const testData = { mode: 'transparent' };
      const testDataJson = JSON.stringify(testData);

      // Start in transparent mode
      mockResponses.set('GET:/api/test', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: testDataJson,
      });

      let response = await makeProxyRequest('GET', '/api/test');
      expect(response.body).toBe(testDataJson);

      // Switch to recording
      await setProxyMode('record', sessionId);

      response = await makeProxyRequest('GET', '/api/test');
      expect(response.statusCode).toBe(200);

      // Switch back to transparent
      await setProxyMode('transparent', sessionId);

      // Verify recording was saved
      const recordingPath = path.join(TEST_RECORDINGS_DIR, `${sessionId}.json`);
      const recordingExists = await fs
        .access(recordingPath)
        .then(() => true)
        .catch(() => false);
      expect(recordingExists).toBe(true);
    });

    it('should switch from record to replay', async () => {
      const sessionId = 'switch-test';
      const originalData = { original: true };
      const originalDataJson = JSON.stringify(originalData);

      // Record a request
      mockResponses.set('GET:/api/switch', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: originalDataJson,
      });

      await setProxyMode('record', sessionId);
      await makeProxyRequest('GET', '/api/switch');
      await setProxyMode('transparent', sessionId);

      // Now replay it
      await setProxyMode('replay', sessionId);
      const response = await makeProxyRequest('GET', '/api/switch');

      expect(response.body).toBe(originalDataJson);
    });
  });
});

// Helper functions
interface RequestOptions {
  body?: string;
  headers?: Record<string, string>;
}

interface ProxyResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function makeProxyRequest(
  method: string,
  path: string,
  options?: RequestOptions,
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PROXY_PORT,
        path,
        method,
        headers: options?.headers || {},
      },
      (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk.toString();
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode!,
            headers: res.headers,
            body,
          });
        });
      },
    );

    req.on('error', reject);

    if (options?.body) {
      req.write(options.body);
    }

    req.end();
  });
}

interface ControlRequest {
  mode: string;
  id: string;
  timeout?: number;
}

async function setProxyMode(
  mode: string,
  id: string,
  timeout?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body: ControlRequest = { mode, id, ...(timeout && { timeout }) };
    const postData = JSON.stringify(body);

    const req = http.request(
      {
        hostname: 'localhost',
        port: PROXY_PORT,
        path: '/__control',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Failed to set mode: ${responseData}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
