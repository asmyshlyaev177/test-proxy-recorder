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
  let lastBackendRequestBody = '';

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

      // Collect request body and store it for verification
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        lastBackendRequestBody = Buffer.concat(chunks).toString('utf8');
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
    lastBackendRequestBody = '';

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

    it('should proxy PUT requests with body', async () => {
      const requestData = { name: 'Updated Charlie', age: 30 };
      const responseData = { id: 123, name: 'Updated Charlie', age: 30 };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('PUT:/api/users/123', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      const response = await makeProxyRequest('PUT', '/api/users/123', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(responseDataJson);
    });

    it('should proxy PATCH requests with body', async () => {
      const requestData = { age: 31 };
      const responseData = { id: 123, name: 'Charlie', age: 31 };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('PATCH:/api/users/123', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      const response = await makeProxyRequest('PATCH', '/api/users/123', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(responseDataJson);
    });

    it('should forward 404 error responses from target', async () => {
      const response = await makeProxyRequest('GET', '/api/nonexistent');

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain('Not found');
    });

    it('should forward 400 error responses from target', async () => {
      const errorBody = JSON.stringify({
        error: 'Validation failed',
        message: 'Missing required field: email',
        field: 'email',
      });

      mockResponses.set('POST:/api/invalid', {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: errorBody,
      });

      const response = await makeProxyRequest('POST', '/api/invalid', {
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toBe(errorBody);
    });

    it('should forward 500 error responses from target', async () => {
      const errorBody = JSON.stringify({
        error: 'Internal server error',
        message: 'Database connection failed',
      });

      mockResponses.set('GET:/api/error', {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: errorBody,
      });

      const response = await makeProxyRequest('GET', '/api/error');

      expect(response.statusCode).toBe(500);
      expect(response.body).toBe(errorBody);
    });

    it('should forward 401 unauthorized responses from target', async () => {
      const errorBody = JSON.stringify({
        error: 'Authentication required',
        message: 'Invalid or expired token',
        code: 'TOKEN_EXPIRED',
      });

      mockResponses.set('GET:/api/protected', {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="api"',
        },
        body: errorBody,
      });

      const response = await makeProxyRequest('GET', '/api/protected');

      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer realm="api"');
      expect(response.body).toBe(errorBody);
    });

    it('should forward 403 forbidden responses from target', async () => {
      const errorBody = JSON.stringify({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });

      mockResponses.set('GET:/api/admin', {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: errorBody,
      });

      const response = await makeProxyRequest('GET', '/api/admin');

      expect(response.statusCode).toBe(403);
      expect(response.body).toBe(errorBody);
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
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
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

      // Verify backend received the request body
      expect(lastBackendRequestBody).toBe(requestDataJson);

      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.method).toBe('POST');
      expect(recording.recordings[0].request.body).toBe(requestDataJson);
      expect(recording.recordings[0].response.statusCode).toBe(201);
    });

    it('should record PUT request with body', async () => {
      const requestData = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };
      const responseData = {
        id: 789,
        name: 'Updated Name',
        email: 'updated@example.com',
      };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('PUT:/api/users/789', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      await makeProxyRequest('PUT', '/api/users/789', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      // Verify backend received the request body
      expect(lastBackendRequestBody).toBe(requestDataJson);

      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.method).toBe('PUT');
      expect(recording.recordings[0].request.url).toBe('/api/users/789');
      expect(recording.recordings[0].request.body).toBe(requestDataJson);
      expect(recording.recordings[0].response.statusCode).toBe(200);
      expect(recording.recordings[0].response.body).toBe(responseDataJson);
    });

    it('should record PATCH request with body', async () => {
      const requestData = { email: 'patched@example.com' };
      const responseData = {
        id: 101,
        email: 'patched@example.com',
        updated: true,
      };
      const requestDataJson = JSON.stringify(requestData);
      const responseDataJson = JSON.stringify(responseData);

      mockResponses.set('PATCH:/api/users/101', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: responseDataJson,
      });

      await makeProxyRequest('PATCH', '/api/users/101', {
        body: requestDataJson,
        headers: { 'Content-Type': 'application/json' },
      });

      // Verify backend received the request body
      expect(lastBackendRequestBody).toBe(requestDataJson);

      await setProxyMode('transparent', sessionId);

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.method).toBe('PATCH');
      expect(recording.recordings[0].request.url).toBe('/api/users/101');
      expect(recording.recordings[0].request.body).toBe(requestDataJson);
      expect(recording.recordings[0].response.statusCode).toBe(200);
      expect(recording.recordings[0].response.body).toBe(responseDataJson);
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

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings).toHaveLength(2);
      expect(recording.recordings[0].request.url).toBe('/api/users');
      expect(recording.recordings[1].request.url).toBe('/api/posts');
    });

    it('should record return different responses to the same endpoint', async () => {
      const getResponse1 = { data: 'first get' };
      const postRequest = { name: 'test' };
      const postResponse = { id: 1, name: 'test' };
      const getResponse2 = { data: 'second get' };

      mockResponses.set('GET:/api', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getResponse1),
      });

      mockResponses.set('POST:/api-post', {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postResponse),
      });

      // First GET request
      const response1 = await makeProxyRequest('GET', '/api');
      expect(response1.statusCode).toBe(200);
      expect(response1.body).toBe(JSON.stringify(getResponse1));

      // POST request
      const response2 = await makeProxyRequest('POST', '/api-post', {
        body: JSON.stringify(postRequest),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(response2.statusCode).toBe(201);
      expect(response2.body).toBe(JSON.stringify(postResponse));

      // Update mock for second GET
      mockResponses.set('GET:/api', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getResponse2),
      });

      // Second GET request with different response
      const response3 = await makeProxyRequest('GET', '/api');
      expect(response3.statusCode).toBe(200);
      expect(response3.body).toBe(JSON.stringify(getResponse2));

      await setProxyMode('transparent', sessionId);

      // Verify recording
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings).toHaveLength(3);
      expect(recording.recordings[0].request.method).toBe('GET');
      expect(recording.recordings[0].request.url).toBe('/api');
      expect(recording.recordings[0].response.body).toBe(
        JSON.stringify(getResponse1),
      );
      expect(recording.recordings[1].request.method).toBe('POST');
      expect(recording.recordings[1].request.url).toBe('/api-post');
      expect(recording.recordings[1].response.body).toBe(
        JSON.stringify(postResponse),
      );
      expect(recording.recordings[2].request.method).toBe('GET');
      expect(recording.recordings[2].request.url).toBe('/api');
      expect(recording.recordings[2].response.body).toBe(
        JSON.stringify(getResponse2),
      );
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

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].request.url).toBe(searchUrl);
    });

    it('should correctly record response body for GET requests (stream consumption fix)', async () => {
      // This test verifies that the response body is properly captured
      // even when the response stream is being forwarded to the client.
      // Previously, there was a bug where piping the response stream to
      // the client would prevent the recording mechanism from capturing
      // the response body, resulting in null response bodies in recordings.

      const statusData = {
        status: 'active',
        message: 'Channel manager is operational',
        timestamp: new Date().toISOString()
      };
      const statusDataJson = JSON.stringify(statusData);

      mockResponses.set('GET:/api/v1/channels/test/status', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: statusDataJson,
      });

      // Make the request
      const response = await makeProxyRequest('GET', '/api/v1/channels/test/status');

      // Verify the client receives the correct response
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(statusDataJson);
      expect(JSON.parse(response.body)).toEqual(statusData);

      // Switch back to transparent to save recording
      await setProxyMode('transparent', sessionId);

      // Verify the recording captured the response body
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings).toHaveLength(1);

      const recordedRequest = recording.recordings[0];
      expect(recordedRequest.request.method).toBe('GET');
      expect(recordedRequest.request.url).toBe('/api/v1/channels/test/status');

      // This is the critical assertion - the response must not be null
      expect(recordedRequest.response).toBeTruthy();
      expect(recordedRequest.response.statusCode).toBe(200);
      expect(recordedRequest.response.body).toBe(statusDataJson);

      // Verify the recorded body matches what the backend sent
      const recordedResponseData = JSON.parse(recordedRequest.response.body);
      expect(recordedResponseData).toEqual(statusData);
    });

    it('should filter out incomplete recordings without responses', async () => {
      // This test verifies that recordings without responses are automatically
      // removed when saving the session, preventing replay errors.
      // With the optimized save behavior (only on mode switch), we verify that
      // recordings are properly saved when switching modes.

      const completeData = { status: 'complete', id: 1 };
      const completeDataJson = JSON.stringify(completeData);

      mockResponses.set('GET:/api/complete', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: completeDataJson,
      });

      // Make a request that will complete successfully
      const response = await makeProxyRequest('GET', '/api/complete');
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(completeDataJson);

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );

      // Switch to transparent mode to trigger a save
      // (recordings are only saved on mode switch now)
      await setProxyMode('transparent', sessionId);

      // Wait a bit for the save to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the recording was saved with the complete response
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      // Should have 1 complete recording
      expect(recording.recordings.length).toBe(1);
      expect(recording.recordings[0].response).toBeTruthy();
      expect(recording.recordings[0].response.statusCode).toBe(200);
      expect(recording.recordings[0].request.url).toBe('/api/complete');
    });

    it('should record and forward 404 error responses', async () => {
      const errorBody = JSON.stringify({
        error: 'Resource not found',
        message: 'The requested user does not exist',
        resource: 'user',
        id: '12345',
      });

      mockResponses.set('GET:/api/missing', {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: errorBody,
      });

      const response = await makeProxyRequest('GET', '/api/missing');

      // Verify the error is forwarded to the client
      expect(response.statusCode).toBe(404);
      expect(response.body).toBe(errorBody);

      await setProxyMode('transparent', sessionId);

      // Verify the error response was recorded
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].response.statusCode).toBe(404);
      expect(recording.recordings[0].response.body).toBe(errorBody);
    });

    it('should record and forward 500 error responses', async () => {
      const errorBody = JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to process payment',
        code: 'PAYMENT_PROCESSOR_ERROR',
        requestId: 'req-abc-123',
        timestamp: '2025-01-15T10:30:00Z',
      });

      mockResponses.set('POST:/api/crash', {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: errorBody,
      });

      const response = await makeProxyRequest('POST', '/api/crash', {
        body: JSON.stringify({ action: 'trigger-error' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Verify the error is forwarded to the client
      expect(response.statusCode).toBe(500);
      expect(response.body).toBe(errorBody);

      await setProxyMode('transparent', sessionId);

      // Verify the error response was recorded
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      const recordingContent = await fs.readFile(recordingPath, 'utf8');
      const recording = JSON.parse(recordingContent);

      expect(recording.recordings[0].response.statusCode).toBe(500);
      expect(recording.recordings[0].response.body).toBe(errorBody);
    });
  });

  describe('Replay Mode', () => {
    const sessionId = 'test-replay-session';
    const replayGetData = { replayed: true, data: 'from-recording' };
    const replayPostRequestData = { name: 'Test' };
    const replayPostResponseData = { id: 999, created: true };
    const replayPutRequestData = { name: 'Updated', status: 'active' };
    const replayPutResponseData = {
      id: 555,
      name: 'Updated',
      status: 'active',
    };
    const replayPatchRequestData = { status: 'inactive' };
    const replayPatchResponseData = {
      id: 666,
      status: 'inactive',
      patched: true,
    };

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
          {
            key: 'PUT_api_update_555.json',
            sequence: 0,
            request: {
              method: 'PUT',
              url: '/api/update/555',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPutRequestData),
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPutResponseData),
            },
            timestamp: new Date().toISOString(),
          },
          {
            key: 'PATCH_api_patch_666.json',
            sequence: 0,
            request: {
              method: 'PATCH',
              url: '/api/patch/666',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPatchRequestData),
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(replayPatchResponseData),
            },
            timestamp: new Date().toISOString(),
          },
        ],
        websocketRecordings: [],
      };

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
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

    it('should replay PUT request from record', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('PUT', '/api/update/555', {
        body: JSON.stringify(replayPutRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.body).toBe(JSON.stringify(replayPutResponseData));
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });

    it('should replay PATCH request from record', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('PATCH', '/api/patch/666', {
        body: JSON.stringify(replayPatchRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.body).toBe(JSON.stringify(replayPatchResponseData));
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
    });

    it('should handle repeated requests and return last recorded response', async () => {
      // This test verifies that when the same endpoint is called multiple times,
      // the proxy cycles through available recorded responses using modulo.
      // This is critical for endpoints that are polled (like status endpoints).

      const statusResponse1 = { status: 'pending', progress: 25 };
      const statusResponse2 = { status: 'processing', progress: 50 };
      const statusResponse3 = { status: 'complete', progress: 100 };

      // Create a recording with multiple responses for the same endpoint
      const multiResponseRecording = {
        id: 'test-multi-response-session',
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/status',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(statusResponse1),
            },
            timestamp: new Date().toISOString(),
            key: 'GET_api_status.json',
            sequence: 0,
          },
          {
            request: {
              method: 'GET',
              url: '/api/status',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(statusResponse2),
            },
            timestamp: new Date().toISOString(),
            key: 'GET_api_status.json',
            sequence: 1,
          },
          {
            request: {
              method: 'GET',
              url: '/api/status',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(statusResponse3),
            },
            timestamp: new Date().toISOString(),
            key: 'GET_api_status.json',
            sequence: 2,
          },
        ],
        websocketRecordings: [],
      };

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        'test-multi-response-session.mock.json',
      );
      await fs.writeFile(
        recordingPath,
        JSON.stringify(multiResponseRecording, null, 2),
      );

      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', 'test-multi-response-session');

      // Make 5 requests to the same endpoint
      const response1 = await makeProxyRequest('GET', '/api/status');
      const response2 = await makeProxyRequest('GET', '/api/status');
      const response3 = await makeProxyRequest('GET', '/api/status');
      const response4 = await makeProxyRequest('GET', '/api/status');
      const response5 = await makeProxyRequest('GET', '/api/status');

      // Verify all responses succeeded
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(response3.statusCode).toBe(200);
      expect(response4.statusCode).toBe(200);
      expect(response5.statusCode).toBe(200);

      // Verify GET requests cycle through responses sequentially
      // Request 1 -> sequence 0 (statusResponse1)
      // Request 2 -> sequence 1 (statusResponse2)
      // Request 3 -> sequence 2 (statusResponse3)
      // Request 4 -> sequence 2 again
      expect(JSON.parse(response1.body)).toEqual(statusResponse1);
      expect(JSON.parse(response2.body)).toEqual(statusResponse2);
      expect(JSON.parse(response3.body)).toEqual(statusResponse3);
      expect(JSON.parse(response4.body)).toEqual(statusResponse3);
      expect(JSON.parse(response5.body)).toEqual(statusResponse3);

      // Backend should never be called
      expect(backendRequestCount).toBe(initialRequestCount);
    });

    it('should skip incomplete recordings during replay', async () => {
      // This test verifies that recordings without responses are automatically
      // skipped during replay, preventing errors.

      const completeResponse = { data: 'complete response' };

      // Create a recording with one incomplete and one complete recording
      const mixedRecording = {
        id: 'test-incomplete-replay-session',
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/mixed',
              headers: {},
              body: null,
            },
            timestamp: new Date().toISOString(),
            key: 'GET_api_mixed.json',
            sequence: 0,
            // No response - incomplete
          },
          {
            request: {
              method: 'GET',
              url: '/api/mixed',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(completeResponse),
            },
            timestamp: new Date().toISOString(),
            key: 'GET_api_mixed.json',
            sequence: 1,
          },
        ],
        websocketRecordings: [],
      };

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        'test-incomplete-replay-session.mock.json',
      );
      await fs.writeFile(
        recordingPath,
        JSON.stringify(mixedRecording, null, 2),
      );

      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', 'test-incomplete-replay-session');

      // Make a request - should skip the incomplete recording and use the complete one
      const response = await makeProxyRequest('GET', '/api/mixed');

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(completeResponse);

      // Backend should not be called
      expect(backendRequestCount).toBe(initialRequestCount);
    });

    it('should return default response when recording not found', async () => {
      const initialRequestCount = backendRequestCount;
      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('GET', '/api/nonexistent');

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        data: [],
        items: [],
        results: [],
        updated_at: '0001-01-01T00:00:00Z',
      });
      expect(backendRequestCount).toBe(initialRequestCount); // Backend should not be called
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
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-expose-headers']).toBe('*');
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
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'DELETE',
      );
      expect(response.headers['access-control-expose-headers']).toBe('*');

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

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2));

      await setProxyMode('replay', sessionId);

      const response = await makeProxyRequest('GET', '/api/cors-replay', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'PATCH',
      );
      expect(response.headers['access-control-expose-headers']).toBe('*');
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

    it('should add CORS headers to error responses in transparent mode', async () => {
      mockResponses.set('GET:/api/error-cors', {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      });

      const response = await makeProxyRequest('GET', '/api/error-cors', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should add CORS headers to replay error responses', async () => {
      await setProxyMode('replay', 'nonexistent-session');

      const response = await makeProxyRequest('GET', '/api/not-recorded', {
        headers: { Origin: testOrigin },
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle custom Access-Control-Request-Headers in record mode', async () => {
      const sessionId = 'cors-custom-headers-test';
      const customHeaders = 'X-Custom-Header, X-Another-Header, Authorization';

      mockResponses.set('GET:/api/custom-headers', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      });

      await setProxyMode('record', sessionId);

      const response = await makeProxyRequest('GET', '/api/custom-headers', {
        headers: {
          Origin: testOrigin,
          'Access-Control-Request-Headers': customHeaders,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
      expect(response.headers['access-control-allow-headers']).toBe(
        customHeaders,
      );

      await setProxyMode('transparent', sessionId);
    });

    it('should use wildcard origin when no origin header is provided', async () => {
      mockResponses.set('GET:/api/no-origin', {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
      });

      const response = await makeProxyRequest('GET', '/api/no-origin');

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
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
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
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

      // Replay the requests - GET requests cycle through responses sequentially
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

      // Replay first request - sequential replay returns first response
      const replay1 = await makeProxyRequest('GET', '/api/test');
      expect(JSON.parse(replay1.body).data).toBe('first');

      // Second replay request returns second response
      const replay1b = await makeProxyRequest('GET', '/api/test');
      expect(JSON.parse(replay1b.body).data).toBe('second');

      // Switch back to transparent and then replay again - resets sequence counter
      await setProxyMode('transparent', sessionId);
      await setProxyMode('replay', sessionId);

      // After reset, starts from first response again
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
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
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
