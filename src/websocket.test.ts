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
import { WebSocket, WebSocketServer } from 'ws';

import { ProxyServer } from './ProxyServer.js';

const TEST_RECORDINGS_DIR = path.join(
  process.cwd(),
  'test-recordings-websocket',
);
const PROXY_PORT = 9879;
const MOCK_SERVER_PORT = 9880;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

describe('ProxyServer WebSocket Tests', () => {
  let proxyServer: ProxyServer;
  let proxyHttpServer: http.Server | null = null;
  let mockServer: http.Server | null = null;
  let wss: WebSocketServer | null = null;
  let receivedMessages: string[] = [];

  beforeAll(async () => {
    // Create mock backend server with WebSocket support
    mockServer = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('Mock HTTP server');
    });

    // Create WebSocket server
    wss = new WebSocketServer({ server: mockServer });

    wss.on('connection', (ws) => {
      console.log('Backend WebSocket connection established');

      ws.on('message', (data) => {
        const message = data.toString();
        console.log('Backend received:', message);
        receivedMessages.push(message);

        // Echo the message back with a prefix
        ws.send(`echo: ${message}`);
      });

      ws.on('close', () => {
        console.log('Backend WebSocket connection closed');
      });

      // Send a welcome message
      ws.send('welcome');
    });

    await new Promise<void>((resolve) => {
      mockServer!.listen(MOCK_SERVER_PORT, () => {
        console.log(
          `Mock server with WebSocket listening on port ${MOCK_SERVER_PORT}`,
        );
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (wss) {
      wss.close();
      wss = null;
    }

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

    // Reset received messages
    receivedMessages = [];

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
    it('should proxy WebSocket connections to backend', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          console.log('Client WebSocket connected');
          ws.send('hello');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          console.log('Client received:', message);
          messages.push(message);

          if (messages.length === 2) {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });

        ws.on('close', () => {
          console.log('Client WebSocket closed');
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: hello');
      expect(receivedMessages).toContain('hello');
    });

    it('should handle multiple WebSocket messages', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];
      const messagesToSend = ['message1', 'message2', 'message3'];

      await new Promise<void>((resolve, reject) => {
        let sentCount = 0;

        ws.on('open', () => {
          ws.send(messagesToSend[0]);
          sentCount++;
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          // Skip welcome message
          if (message === 'welcome') {
            return;
          }

          // Send next message
          if (sentCount < messagesToSend.length) {
            ws.send(messagesToSend[sentCount]);
            sentCount++;
          } else {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: message1');
      expect(messages).toContain('echo: message2');
      expect(messages).toContain('echo: message3');
      expect(receivedMessages).toEqual(messagesToSend);
    });

    it('should handle bidirectional WebSocket communication', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const clientMessages: string[] = [];
      let serverMessagesReceived = 0;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('test-message');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          clientMessages.push(message);
          serverMessagesReceived++;

          if (serverMessagesReceived === 2) {
            // Received welcome + echo
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(clientMessages.length).toBe(2);
      expect(clientMessages).toContain('welcome');
      expect(clientMessages).toContain('echo: test-message');
    });

    it('should handle WebSocket connection close', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      let closeReceived = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.close();
        });

        ws.on('close', () => {
          closeReceived = true;
          resolve();
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(closeReceived).toBe(true);
    });
  });

  describe('Record Mode', () => {
    const sessionId = 'websocket-recording-session';

    beforeEach(async () => {
      await setProxyMode('record', sessionId);
    });

    it('should record WebSocket messages in record mode', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('recording-test');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          if (messages.length === 2) {
            ws.close();
          }
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: recording-test');
      expect(receivedMessages).toContain('recording-test');

      // Switch back to transparent to save recording and wait for save to complete
      await setProxyMode('transparent', sessionId);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify recording file was created with WebSocket data
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      let recording;
      try {
        const recordingContent = await fs.readFile(recordingPath, 'utf8');
        recording = JSON.parse(recordingContent);
      } catch (error) {
        console.error('Failed to read recording file:', error);
        throw error;
      }

      expect(recording.id).toBe(sessionId);
      expect(recording.websocketRecordings).toBeDefined();
      expect(recording.websocketRecordings).toHaveLength(1);

      const wsRecording = recording.websocketRecordings[0];
      expect(wsRecording.url).toBe('/ws');
      expect(wsRecording.messages.length).toBeGreaterThan(0);

      // Check for server-to-client messages (welcome, echo)
      const serverMessages = wsRecording.messages.filter(
        (m: { direction: string }) => m.direction === 'server-to-client',
      );
      expect(serverMessages.length).toBeGreaterThanOrEqual(2);

      // Check for client-to-server messages
      const clientMessages = wsRecording.messages.filter(
        (m: { direction: string }) => m.direction === 'client-to-server',
      );
      expect(clientMessages.length).toBeGreaterThanOrEqual(1);
      expect(clientMessages[0].data).toBe('recording-test');
    });

    it('should record multiple WebSocket messages', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];
      const messagesToSend = ['msg1', 'msg2', 'msg3'];

      await new Promise<void>((resolve, reject) => {
        let sentCount = 0;

        ws.on('open', () => {
          ws.send(messagesToSend[0]);
          sentCount++;
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          if (message === 'welcome') {
            return;
          }

          if (sentCount < messagesToSend.length) {
            ws.send(messagesToSend[sentCount]);
            sentCount++;
          } else {
            ws.close();
          }
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      await setProxyMode('transparent', sessionId);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify all messages were received
      expect(messages.length).toBeGreaterThan(0);

      // Verify all messages were recorded
      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      let recording;
      try {
        const recordingContent = await fs.readFile(recordingPath, 'utf8');
        recording = JSON.parse(recordingContent);
      } catch (error) {
        console.error('Failed to read recording file:', error);
        throw error;
      }

      const wsRecording = recording.websocketRecordings[0];
      const clientMessages = wsRecording.messages.filter(
        (m: { direction: string }) => m.direction === 'client-to-server',
      );

      expect(clientMessages.length).toBe(3);
      expect(clientMessages.map((m: { data: string }) => m.data)).toEqual(
        messagesToSend,
      );
    });

    it('should allow WebSocket communication while recording HTTP requests', async () => {
      // Make an HTTP request
      const httpResponse = await makeProxyRequest('GET', '/api/test');
      expect(httpResponse.statusCode).toBe(200);

      // Establish WebSocket connection
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('mixed-mode-test');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          if (messages.length === 2) {
            ws.close();
          }
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: mixed-mode-test');
    });
  });

  describe('Replay Mode', () => {
    const sessionId = 'websocket-replay-session';

    beforeEach(async () => {
      // Create a recording file with WebSocket data
      const recording = {
        id: sessionId,
        recordings: [],
        websocketRecordings: [
          {
            url: '/ws',
            key: 'WS__ws',
            timestamp: new Date().toISOString(),
            messages: [
              {
                direction: 'server-to-client',
                data: 'welcome',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'client-to-server',
                data: 'replay-test',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'server-to-client',
                data: 'echo: replay-test',
                timestamp: new Date().toISOString(),
              },
            ],
          },
        ],
      };

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${sessionId}.mock.json`,
      );
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2));

      await setProxyMode('replay', sessionId);
    });

    it('should replay WebSocket messages from record', async () => {
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];
      const initialBackendRequestCount = receivedMessages.length;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          console.log('Replay: WebSocket opened');
          ws.send('replay-test');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          console.log('Replay: Received message:', message);
          messages.push(message);

          // We expect: welcome (initial), then echo after client sends
          if (messages.length === 2) {
            ws.close();
          }
        });

        ws.on('close', () => {
          console.log('Replay: WebSocket closed');
          resolve();
        });

        ws.on('error', (err) => {
          console.error('Replay: WebSocket error:', err);
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // Backend should NOT be hit in replay mode
      expect(receivedMessages.length).toBe(initialBackendRequestCount);

      // Should receive recorded messages
      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: replay-test');
    });

    it('should replay multiple WebSocket messages', async () => {
      // Create recording with multiple messages
      const multiSessionId = 'multi-replay-session';
      const recording = {
        id: multiSessionId,
        recordings: [],
        websocketRecordings: [
          {
            url: '/ws',
            key: 'WS__ws',
            timestamp: new Date().toISOString(),
            messages: [
              {
                direction: 'server-to-client',
                data: 'welcome',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'client-to-server',
                data: 'msg1',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'server-to-client',
                data: 'echo: msg1',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'client-to-server',
                data: 'msg2',
                timestamp: new Date().toISOString(),
              },
              {
                direction: 'server-to-client',
                data: 'echo: msg2',
                timestamp: new Date().toISOString(),
              },
            ],
          },
        ],
      };

      const recordingPath = path.join(
        TEST_RECORDINGS_DIR,
        `${multiSessionId}.mock.json`,
      );
      await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2));
      await setProxyMode('replay', multiSessionId);

      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);
      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        let sentCount = 0;

        ws.on('open', () => {
          ws.send('msg1');
          sentCount++;
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          if (message === 'welcome') {
            return;
          }

          if (sentCount < 2 && message.startsWith('echo:')) {
            ws.send('msg2');
            sentCount++;
          } else if (sentCount === 2 && message.startsWith('echo:')) {
            ws.close();
          }
        });

        ws.on('close', () => {
          resolve();
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: msg1');
      expect(messages).toContain('echo: msg2');
    });

    it('should return 404 when WebSocket recording not found', async () => {
      // Try to connect to a path that's not in the recording
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/nonexistent`);

      let errorReceived = false;

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          reject(
            new Error('WebSocket should not open for nonexistent recording'),
          );
        });

        ws.on('error', () => {
          errorReceived = true;
        });

        ws.on('close', () => {
          resolve();
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(errorReceived).toBe(true);
    });
  });

  describe('Mode Switching with WebSockets', () => {
    it('should handle WebSocket in transparent mode after switching from record', async () => {
      const sessionId = 'mode-switch-ws-test';

      // Start in record mode
      await setProxyMode('record', sessionId);

      // Switch to transparent mode
      await setProxyMode('transparent', sessionId);

      // Establish WebSocket connection
      const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/ws`);

      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('after-switch');
        });

        ws.on('message', (data) => {
          const message = data.toString();
          messages.push(message);

          if (messages.length === 2) {
            ws.close();
            resolve();
          }
        });

        ws.on('error', (err) => {
          reject(err);
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      expect(messages).toContain('welcome');
      expect(messages).toContain('echo: after-switch');
    });
  });
});

// Helper functions
interface ProxyResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function makeProxyRequest(
  method: string,
  path: string,
): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PROXY_PORT,
        path,
        method,
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
