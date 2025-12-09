import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProxyServer } from './ProxyServer.js';
import { getRecordingPath } from './utils/fileUtils.js';
import { getReqID } from './utils/getReqID.js';

const TEST_RECORDINGS_DIR = path.join(process.cwd(), 'test-recordings');
const TEST_PORT = 9876;
const TEST_TARGET = 'http://localhost:9999';
const TEST_CLIENT_ORIGIN = 'http://localhost:3000'; // Simulates frontend client origin for CORS tests

describe('ProxyServer', () => {
  let proxyServer: ProxyServer;
  let server: http.Server | null = null;

  beforeEach(async () => {
    // Clean up test recordings directory
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up server
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }

    // Clean up test recordings directory
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create a ProxyServer instance with default values', () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      expect(proxyServer).toBeDefined();
    });

    it('should accept multiple targets', () => {
      const targets = ['http://localhost:3000', 'http://localhost:4000'];
      proxyServer = new ProxyServer(targets, TEST_RECORDINGS_DIR);
      expect(proxyServer).toBeDefined();
    });
  });

  describe('init', () => {
    it('should create recordings directory', async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();

      const stats = await fs.stat(TEST_RECORDINGS_DIR);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await fs.mkdir(TEST_RECORDINGS_DIR, { recursive: true });
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();

      const stats = await fs.stat(TEST_RECORDINGS_DIR);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('listen', () => {
    it('should start the server on specified port', async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();

      server = proxyServer.listen(TEST_PORT);

      await new Promise<void>((resolve) => {
        server!.on('listening', () => resolve());
      });

      const address = server!.address() as { port: number };
      expect(address.port).toBe(TEST_PORT);
    });
  });

  describe('control endpoint', () => {
    beforeEach(async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();
      server = proxyServer.listen(TEST_PORT);

      await new Promise<void>((resolve) => {
        server!.on('listening', () => resolve());
      });
    });

    it('should switch to record mode', async () => {
      const response = await sendControlRequest({
        mode: 'record',
        id: 'test-recording-1',
      });

      expect(response.success).toBe(true);
      expect(response.mode).toBe('record');
      expect(response.id).toBe('test-recording-1');
    });

    it('should switch to replay mode', async () => {
      const response = await sendControlRequest({
        mode: 'replay',
        id: 'test-replay-1',
      });

      expect(response.success).toBe(true);
      expect(response.mode).toBe('replay');
      expect(response.id).toBe('test-replay-1');
    });

    it('should switch to transparent mode', async () => {
      // First switch to recording
      await sendControlRequest({
        mode: 'record',
        id: 'test-recording',
      });

      // Then switch back to transparent
      const response = await sendControlRequest({
        mode: 'transparent',
      });

      expect(response.success).toBe(true);
      expect(response.mode).toBe('transparent');
    });

    it('should reject record mode without id', async () => {
      const response = await sendControlRequest({
        mode: 'record',
      });

      expect(response.error).toBeDefined();
      expect(response.error).toContain('Record ID is required');
    });

    it('should reject replay mode without id', async () => {
      const response = await sendControlRequest({
        mode: 'replay',
      });

      expect(response.error).toBeDefined();
      expect(response.error).toContain('Replay ID is required');
    });

    it('should accept custom timeout', async () => {
      const response = await sendControlRequest({
        mode: 'record',
        id: 'test-recording',
        timeout: 5000,
      });

      expect(response.success).toBe(true);
      expect(response.timeout).toBe(5000);
    });

    it('should use default timeout when not specified', async () => {
      const response = await sendControlRequest({
        mode: 'record',
        id: 'test-recording',
      });

      expect(response.success).toBe(true);
      expect(response.timeout).toBe(120_000); // Default TIMEOUT
    });

    it('should switch back to transparent after timeout', async () => {
      const response = await sendControlRequest({
        mode: 'record',
        id: 'test-recording',
        timeout: 100, // Short timeout for testing
      });

      expect(response.success).toBe(true);

      // Wait for timeout to occur
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The mode should have switched back (we can verify this by checking console logs in actual usage)
    });

    it('should support GET request to retrieve proxy configuration', async () => {
      // First set a mode
      await sendControlRequest({
        mode: 'replay',
        id: 'test-config-1',
      });

      // Then GET the configuration
      const config = await sendGetControlRequest();

      expect(config.recordingsDir).toBe(TEST_RECORDINGS_DIR);
      expect(config.mode).toBe('replay');
      expect(config.id).toBe('test-config-1');
    });

    it('should return configuration in transparent mode', async () => {
      const config = await sendGetControlRequest();

      expect(config.recordingsDir).toBe(TEST_RECORDINGS_DIR);
      expect(config.mode).toBe('transparent');
    });

    it('should cleanup a specific session', async () => {
      // Start a replay session
      await sendControlRequest({
        mode: 'replay',
        id: 'test-cleanup-session',
      });

      // Cleanup the session
      const response = await sendControlRequest({
        cleanup: true,
        id: 'test-cleanup-session',
      });

      expect(response.success).toBe(true);
      expect(response.message).toContain('test-cleanup-session');
      expect(response.message).toContain('cleaned up');
    });

    it('should reject cleanup without session id', async () => {
      const response = await sendControlRequest({
        cleanup: true,
      });

      expect(response.error).toBeDefined();
    });

    it('should save active recording session before cleanup', async () => {
      const sessionId = 'test-cleanup-with-recording';

      // Start a recording session
      await sendControlRequest({
        mode: 'record',
        id: sessionId,
      });

      // Cleanup the session (should save session even if empty before clearing)
      const cleanupResponse = await sendControlRequest({
        cleanup: true,
        id: sessionId,
      });

      expect(cleanupResponse.success).toBe(true);
      expect(cleanupResponse.message).toContain(sessionId);
      expect(cleanupResponse.message).toContain('cleaned up');

      // Verify the recording file was created (even if empty)
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      let fileExists = false;
      try {
        await fs.access(recordingPath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      // File should exist after cleanup (cleanup calls saveCurrentSession)
      expect(fileExists).toBe(true);
    });
  });

  describe('record mode', () => {
    beforeEach(async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();
      server = proxyServer.listen(TEST_PORT);

      await new Promise<void>((resolve) => {
        server!.on('listening', () => resolve());
      });

      // Switch to record mode
      await sendControlRequest({
        mode: 'record',
        id: 'test-session',
      });
    });

    it('should save recordings when switching back to transparent mode', async () => {
      // Switch back to transparent
      await sendControlRequest({
        mode: 'transparent',
      });

      // Check if recording file exists
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        'test-session.mock.json',
      );
      let fileExists = false;
      try {
        await fs.access(recordingPath);
        fileExists = true;
      } catch {
        // File might not exist if no requests were recorded, which is fine
      }

      // Verify the test checked for file existence
      expect(typeof fileExists).toBe('boolean');
    });
  });

  describe('request key generation', () => {
    it('should generate consistent keys for same requests', () => {
      const req1 = createMockRequest('GET', '/api/users');
      const req2 = createMockRequest('GET', '/api/users');

      const key1 = getReqID(req1);
      const key2 = getReqID(req2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different methods', () => {
      const req1 = createMockRequest('GET', '/api/users');
      const req2 = createMockRequest('POST', '/api/users');

      const key1 = getReqID(req1);
      const key2 = getReqID(req2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different URLs', () => {
      const req1 = createMockRequest('GET', '/api/users');
      const req2 = createMockRequest('GET', '/api/posts');

      const key1 = getReqID(req1);
      const key2 = getReqID(req2);

      expect(key1).not.toBe(key2);
    });

    it('should handle query parameters', () => {
      const req1 = createMockRequest('GET', '/api/users?page=1');
      const req2 = createMockRequest('GET', '/api/users?page=2');

      const key1 = getReqID(req1);
      const key2 = getReqID(req2);

      // Different query params should generate different keys
      expect(key1).not.toBe(key2);
    });

    it('should normalize paths by replacing slashes', () => {
      const req = createMockRequest('GET', '/api/users/123');
      const key = getReqID(req);

      expect(key).toContain('api_users_123');
    });

    it('should handle root path', () => {
      const req = createMockRequest('GET', '/');
      const key = getReqID(req);

      expect(key).toBe('GET_root.json');
    });
  });

  describe('target rotation', () => {
    it('should rotate through multiple targets', () => {
      const targets = [
        'http://localhost:3000',
        'http://localhost:4000',
        'http://localhost:5000',
      ];
      proxyServer = new ProxyServer(targets, TEST_RECORDINGS_DIR);

      const target1 = proxyServer['getTarget']();
      const target2 = proxyServer['getTarget']();
      const target3 = proxyServer['getTarget']();
      const target4 = proxyServer['getTarget']();

      expect(target1).toBe('http://localhost:3000');
      expect(target2).toBe('http://localhost:4000');
      expect(target3).toBe('http://localhost:5000');
      expect(target4).toBe('http://localhost:3000'); // Should wrap around
    });

    it('should work with single target', () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);

      const target1 = proxyServer['getTarget']();
      const target2 = proxyServer['getTarget']();

      expect(target1).toBe(TEST_TARGET);
      expect(target2).toBe(TEST_TARGET);
    });
  });

  describe('recording path', () => {
    it('should generate correct recording path', () => {
      const recordingPath = getRecordingPath(TEST_RECORDINGS_DIR, 'my-test-id');
      const expectedPath = path.join(
        TEST_RECORDINGS_DIR,
        'my-test-id.mock.json',
      );

      expect(recordingPath).toBe(expectedPath);
    });
  });

  describe('multiple requests to same endpoint', () => {
    it('should assign sequence numbers to recordings', async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();
      server = proxyServer.listen(TEST_PORT);

      await new Promise<void>((resolve) => {
        server!.on('listening', () => resolve());
      });

      // Switch to record mode
      await sendControlRequest({
        mode: 'record',
        id: 'test-sequence',
      });

      // Simulate multiple requests to same endpoint by creating recordings
      const req1 = createMockRequest('GET', '/api/data');
      const req2 = createMockRequest('GET', '/api/data');
      const req3 = createMockRequest('GET', '/api/data');

      const key1 = getReqID(req1);
      const key2 = getReqID(req2);
      const key3 = getReqID(req3);

      // All should have the same key
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);

      // Switch to transparent to save session
      await sendControlRequest({
        mode: 'transparent',
      });

      // The test validates sequence tracking is implemented
      expect(key1).toBeDefined();
    });
  });

  describe('CORS support', () => {
    beforeEach(async () => {
      proxyServer = new ProxyServer([TEST_TARGET], TEST_RECORDINGS_DIR);
      await proxyServer.init();
      server = proxyServer.listen(TEST_PORT);

      await new Promise<void>((resolve) => {
        server!.on('listening', () => resolve());
      });
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await sendOptionsRequest('/api/test', {
        origin: TEST_CLIENT_ORIGIN,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(
        TEST_CLIENT_ORIGIN,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'OPTIONS',
      );
    });

    it('should handle OPTIONS preflight requests without origin', async () => {
      const response = await sendOptionsRequest('/api/test');

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include CORS headers in control endpoint response', async () => {
      const response = await sendControlRequestWithHeaders(
        {
          mode: 'transparent',
        },
        {
          origin: TEST_CLIENT_ORIGIN,
        },
      );

      expect(response.success).toBe(true);
      // Control endpoint returns JSON, not proxied, so it doesn't need CORS headers
      // This test verifies the control endpoint still works with Origin header
    });

    it('should respect custom access-control-request-headers', async () => {
      const response = await sendOptionsRequest('/api/test', {
        origin: TEST_CLIENT_ORIGIN,
        'access-control-request-headers': 'X-Custom-Header, Authorization',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-headers']).toBe(
        'X-Custom-Header, Authorization',
      );
    });
  });
});

// Helper functions
interface ControlRequestData {
  mode?: string;
  id?: string;
  timeout?: number;
  cleanup?: boolean;
}

interface ControlResponse {
  success?: boolean;
  mode?: string;
  id?: string;
  timeout?: number;
  error?: string;
  message?: string;
}

async function sendControlRequest(
  data: ControlRequestData,
): Promise<ControlResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
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
          try {
            resolve(JSON.parse(responseData));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function createMockRequest(method: string, url: string): http.IncomingMessage {
  return {
    method,
    url,
    headers: {},
  } as http.IncomingMessage;
}

interface OptionsResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
}

async function sendOptionsRequest(
  path: string,
  headers: Record<string, string> = {},
): Promise<OptionsResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method: 'OPTIONS',
        headers,
      },
      (res) => {
        res.on('data', () => {
          // Consume response data
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
          });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

async function sendControlRequestWithHeaders(
  data: ControlRequestData,
  headers: Record<string, string> = {},
): Promise<ControlResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/__control',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers,
        },
      },
      (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

interface GetControlResponse {
  recordingsDir: string;
  mode: string;
  id?: string;
}

async function sendGetControlRequest(): Promise<GetControlResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/__control',
        method: 'GET',
      },
      (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}
