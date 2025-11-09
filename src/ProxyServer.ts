import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { Duplex } from 'node:stream';

import httpProxy from 'http-proxy';
import { WebSocket, WebSocketServer } from 'ws';

import {
  CONTROL_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from './constants.js';
import {
  type ControlRequest,
  type Mode,
  Modes,
  type Recording,
  type RecordingSession,
  type WebSocketRecording,
} from './types.js';
import {
  getRecordingPath,
  loadRecordingSession,
  saveRecordingSession,
} from './utils/fileUtils.js';
import { getReqID } from './utils/getReqID';
import { readRequestBody, sendJsonResponse } from './utils/httpHelpers.js';

export class ProxyServer {
  private targets: string[];
  private currentTargetIndex: number;
  private mode: Mode;
  private recordingId: string | null;
  private replayId: string | null;
  private modeTimeout: NodeJS.Timeout | null;
  private proxy: httpProxy;
  private currentSession: RecordingSession | null;
  private recordingsDir: string;
  private requestSequenceMap: Map<string, number>; // Track sequence per request key
  private replaySequenceMap: Map<string, number>; // Track replay position per request key

  constructor(targets: string[], recordingsDir: string) {
    this.targets = targets;
    this.currentTargetIndex = 0;
    this.mode = Modes.transparent;
    this.recordingId = null;
    this.replayId = null;
    this.modeTimeout = null;
    this.currentSession = null;
    this.recordingsDir = recordingsDir;
    this.requestSequenceMap = new Map();
    this.replaySequenceMap = new Map();
    this.proxy = httpProxy.createProxyServer({
      secure: false,
      changeOrigin: true,
    });

    this.setupProxyEventHandlers();
  }

  async init(): Promise<void> {
    await fs.mkdir(this.recordingsDir, { recursive: true });
  }

  listen(port: number): http.Server {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Handle WebSocket upgrade requests
    server.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    server.listen(port, () => {
      // Set environment variable so Playwright integration can discover the port
      process.env.TEST_PROXY_RECORDER_PORT = String(port);
      this.logServerStartup(port);
    });

    return server;
  }

  private setupProxyEventHandlers(): void {
    this.proxy.on('error', this.handleProxyError.bind(this));
    this.proxy.on('proxyRes', this.handleProxyResponse.bind(this));
  }

  private handleProxyError(
    err: Error,
    _req: http.IncomingMessage,
    res: unknown,
  ): void {
    console.error('Proxy error:', err);

    if (!(res instanceof http.ServerResponse)) {
      return;
    }

    if (!res.headersSent) {
      res.writeHead(HTTP_STATUS_BAD_GATEWAY, {
        'Content-Type': 'application/json',
      });
    }

    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  }

  private handleProxyResponse(
    proxyRes: http.IncomingMessage,
    req: http.IncomingMessage,
  ): void {
    // Add CORS headers to allow cross-origin requests
    this.addCorsHeaders(proxyRes, req);

    if (this.mode === Modes.record && this.recordingId) {
      this.recordResponse(req, proxyRes);
    }
  }

  private addCorsHeaders(
    proxyRes: http.IncomingMessage,
    req: http.IncomingMessage,
  ): void {
    const origin = req.headers.origin;

    // Allow the requesting origin
    proxyRes.headers['access-control-allow-origin'] = origin || '*';

    // Allow credentials
    proxyRes.headers['access-control-allow-credentials'] = 'true';

    // Allow common headers
    proxyRes.headers['access-control-allow-headers'] =
      req.headers['access-control-request-headers'] ||
      'Origin, X-Requested-With, Content-Type, Accept, Authorization';

    // Allow common methods
    proxyRes.headers['access-control-allow-methods'] =
      'GET, POST, PUT, DELETE, PATCH, OPTIONS';

    // Expose headers to the browser
    proxyRes.headers['access-control-expose-headers'] = '*';
  }

  private getTarget(): string {
    const target = this.targets[this.currentTargetIndex];
    this.currentTargetIndex =
      (this.currentTargetIndex + 1) % this.targets.length;
    return target;
  }

  private async handleControlRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      const body = await readRequestBody(req);
      console.log('MODE CHANGE', body);

      const data: ControlRequest = JSON.parse(body);
      const { mode, id, timeout: requestTimeout } = data;
      const timeout = requestTimeout ?? DEFAULT_TIMEOUT_MS;

      this.clearModeTimeout();
      await this.switchMode(mode, id);
      this.setupModeTimeout(timeout);

      sendJsonResponse(res, HTTP_STATUS_OK, {
        success: true,
        mode: this.mode,
        id: this.recordingId || this.replayId,
        timeout,
      });
    } catch (error) {
      console.error('Control request error:', error);
      sendJsonResponse(res, HTTP_STATUS_BAD_REQUEST, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private clearModeTimeout(): void {
    if (this.modeTimeout) {
      clearTimeout(this.modeTimeout);
      this.modeTimeout = null;
    }
  }

  private async switchMode(mode: Mode, id?: string): Promise<void> {
    // Save current session before switching
    if (this.currentSession) {
      console.log('Switching mode, saving current session first');
      await this.saveCurrentSession();
      console.log('Session saved, continuing with mode switch');
    }

    switch (mode) {
      case Modes.transparent: {
        this.switchToTransparentMode();

        break;
      }
      case Modes.record: {
        this.switchToRecordMode(id);

        break;
      }
      case Modes.replay: {
        this.switchToReplayMode(id);

        break;
      }
      default: {
        throw new Error('Invalid mode. Use: transparent, record, or replay');
      }
    }
  }

  private switchToTransparentMode(): void {
    this.mode = Modes.transparent;
    this.recordingId = null;
    this.replayId = null;
    this.currentSession = null;
    clearTimeout(this.modeTimeout || 0);
    console.log('Switched to transparent mode');
  }

  private switchToRecordMode(id?: string): void {
    if (!id) {
      throw new Error('Record ID is required');
    }
    this.mode = Modes.record;
    this.recordingId = id;
    this.replayId = null;
    this.currentSession = { id, recordings: [], websocketRecordings: [] };
    this.requestSequenceMap.clear(); // Reset sequence tracking
    console.log(`Switched to record mode with ID: ${id}`);
  }

  private switchToReplayMode(id?: string): void {
    if (!id) {
      throw new Error('Replay ID is required');
    }
    this.mode = Modes.replay;
    this.replayId = id;
    this.recordingId = null;
    this.currentSession = null;
    this.replaySequenceMap.clear(); // Reset replay position tracking
    console.log(`Switched to replay mode with ID: ${id}`);
  }

  private setupModeTimeout(timeout: number): void {
    if (timeout && timeout > 0) {
      this.modeTimeout = setTimeout(async () => {
        console.log('Timeout reached, switching back to transparent mode');
        await this.saveCurrentSession();
        this.switchToTransparentMode();
        this.modeTimeout = null;
      }, timeout);
    }
  }

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      console.log('No current session to save');
      return;
    }

    if (
      this.currentSession.recordings.length === 0 &&
      this.currentSession.websocketRecordings.length === 0
    ) {
      console.log('Session has no recordings, skipping save');
      return;
    }

    console.log(
      `Saving session with ${this.currentSession.recordings.length} HTTP and ${this.currentSession.websocketRecordings.length} WebSocket recordings`,
    );
    await saveRecordingSession(this.recordingsDir, this.currentSession);
  }

  private async saveRequestRecord(
    req: http.IncomingMessage,
    body: string,
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const key = getReqID(req);

    // Get and increment sequence number for this key
    const currentSequence = this.requestSequenceMap.get(key) || 0;
    this.requestSequenceMap.set(key, currentSequence + 1);

    const record: Recording = {
      request: {
        method: req.method!,
        url: req.url!,
        headers: req.headers,
        body: body || null,
      },
      timestamp: new Date().toISOString(),
      key,
      sequence: currentSequence,
    };

    this.currentSession.recordings.push(record);
  }

  private async recordResponse(
    req: http.IncomingMessage,
    proxyRes: http.IncomingMessage,
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const key = getReqID(req);
    // Find the most recent record with this key that doesn't have a response yet
    const record = this.currentSession.recordings.findLast(
      (r) => r.key === key && !r.response,
    );

    if (!record) {
      console.error('Request record not found for response:', key);
      return;
    }

    const chunks: Buffer[] = [];
    proxyRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proxyRes.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');

      record.response = {
        statusCode: proxyRes.statusCode!,
        headers: proxyRes.headers,
        body: body || null,
      };

      await this.saveCurrentSession();
      console.log(`Recorded: ${req.method} ${req.url}`);
    });
  }

  private async handleReplayRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const key = getReqID(req);
    const filePath = getRecordingPath(this.recordingsDir, this.replayId!);

    try {
      const session = await loadRecordingSession(filePath);

      // Get current sequence for this key (defaults to 0)
      const currentSequence = this.replaySequenceMap.get(key) || 0;

      // Find recording with matching key and sequence
      const record = session.recordings.find(
        (r) => r.key === key && r.sequence === currentSequence,
      );

      if (!record) {
        throw new Error(
          `No recording found for ${key} with sequence ${currentSequence}`,
        );
      }

      if (!record.response) {
        throw new Error('No response recorded for this request');
      }

      // Increment sequence for next request with same key
      this.replaySequenceMap.set(key, currentSequence + 1);

      const { statusCode, headers, body } = record.response;
      const origin = req.headers.origin;

      // Add CORS headers to replay response
      const responseHeaders = {
        ...headers,
        'access-control-allow-origin': origin || '*',
        'access-control-allow-credentials': 'true',
      };

      res.writeHead(statusCode, responseHeaders);
      res.end(body);

      console.log(
        `Replayed: ${req.method} ${req.url} (sequence: ${currentSequence})`,
      );
    } catch (error) {
      this.handleReplayError(res, error, key, filePath);
    }
  }

  private handleReplayError(
    res: http.ServerResponse,
    err: unknown,
    key: string,
    filePath: string,
  ): void {
    const isFileNotFound =
      err instanceof Error && 'code' in err && err.code === 'ENOENT';
    console.error('Replay error:', err);

    sendJsonResponse(res, HTTP_STATUS_NOT_FOUND, {
      error: isFileNotFound
        ? 'Recording file not found'
        : 'Recording not found',
      message: err instanceof Error ? err.message : 'Unknown error',
      key,
      filePath,
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return this.handleCorsPreflightRequest(req, res);
    }

    if (req.url === CONTROL_ENDPOINT) {
      return this.handleControlRequest(req, res);
    }

    if (this.mode === Modes.replay) {
      return this.handleReplayRequest(req, res);
    }

    await this.handleProxyRequest(req, res);
  }

  private handleCorsPreflightRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const origin = req.headers.origin;

    res.writeHead(HTTP_STATUS_OK, {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers'] ||
        'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Max-Age': '86400', // 24 hours
    });

    res.end();
  }

  private async handleProxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const target = this.getTarget();
    console.log(`[${this.mode}] ${req.method} ${req.url} -> ${target}`);

    if (this.mode === Modes.record) {
      await this.bufferAndProxyRequest(req, res, target);
    } else {
      this.proxy.web(req, res, { target });
    }
  }

  private async bufferAndProxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: string,
  ): Promise<void> {
    // Buffer the request body for recording
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    await new Promise<void>((resolve) => {
      req.on('end', () => resolve());
    });

    // Save the buffered body for recording
    const body = Buffer.concat(chunks).toString('utf8');
    await this.saveRequestRecord(req, body);

    // Determine if we need http or https
    const targetUrl = new URL(target);
    const isHttps = targetUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;

    // Create a new request to proxy with the buffered body
    const proxyReq = requestModule.request(
      {
        hostname: targetUrl.hostname,
        port: targetUrl.port || defaultPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        // Add CORS headers
        this.addCorsHeaders(proxyRes, req);

        // Record the response (including error responses)
        this.recordResponse(req, proxyRes);

        // Forward response to client with original status code and headers
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      // This handles network/connection errors (e.g., ECONNREFUSED, ETIMEDOUT)
      // NOT HTTP error responses (which are handled above in the response callback)
      this.handleProxyError(err, req, res);
    });

    // Write the buffered body to the proxy request
    if (chunks.length > 0) {
      proxyReq.write(Buffer.concat(chunks));
    }

    proxyReq.end();
  }

  private handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (this.mode === Modes.replay) {
      this.handleReplayWebSocket(req, socket);
      return;
    }

    const target = this.getTarget();
    console.log(`[${this.mode}] WebSocket upgrade ${req.url} -> ${target}`);

    if (this.mode === Modes.record) {
      this.handleRecordWebSocket(req, socket, head, target);
    } else {
      // Transparent mode - just proxy through
      this.proxy.ws(req, socket, head, { target });
    }
  }

  private handleRecordWebSocket(
    req: http.IncomingMessage,
    clientSocket: Duplex,
    head: Buffer,
    target: string,
  ): void {
    const url = req.url || '/';
    const key = `WS_${url.replaceAll('/', '_')}`;

    const wsRecording: WebSocketRecording = {
      url,
      messages: [],
      timestamp: new Date().toISOString(),
      key,
    };

    if (this.currentSession) {
      this.currentSession.websocketRecordings.push(wsRecording);
    }

    // Create WebSocket connection to backend
    const backendWsUrl = `${target.replace('http', 'ws')}${url}`;
    const backendWs = new WebSocket(backendWsUrl);

    // Create WebSocket server for client
    const wss = new WebSocketServer({ noServer: true });

    // Wait for backend connection before accepting client
    backendWs.on('open', () => {
      console.log(`WebSocket recording: connected to backend ${backendWsUrl}`);

      wss.handleUpgrade(req, clientSocket, head, (clientWs) => {
        // Forward messages from client to backend
        clientWs.on('message', (data) => {
          const message = data.toString();

          // Record client message
          wsRecording.messages.push({
            direction: 'client-to-server',
            data: message,
            timestamp: new Date().toISOString(),
          });

          // Forward to backend if connected
          if (backendWs.readyState === WebSocket.OPEN) {
            backendWs.send(message);
          }

          this.saveCurrentSession().catch((error) => {
            console.error('Failed to save WebSocket recording:', error);
          });
        });

        // Forward messages from backend to client
        backendWs.on('message', (data) => {
          const message = data.toString();

          // Record server message
          wsRecording.messages.push({
            direction: 'server-to-client',
            data: message,
            timestamp: new Date().toISOString(),
          });

          // Forward to client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
          }

          this.saveCurrentSession().catch((error) => {
            console.error('Failed to save WebSocket recording:', error);
          });
        });

        // Handle errors
        clientWs.on('error', (err) => {
          console.error('Client WebSocket error:', err);
        });

        backendWs.on('error', (err) => {
          console.error('Backend WebSocket error:', err);
        });

        // Handle close
        clientWs.on('close', () => {
          backendWs.close();
          console.log('Client WebSocket closed');
        });

        backendWs.on('close', () => {
          clientWs.close();
          console.log('Backend WebSocket closed');
        });
      });
    });

    backendWs.on('error', (err) => {
      console.error('Backend WebSocket connection error:', err);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.destroy();
    });

    wss.on('error', (err) => {
      console.error('WebSocket server error:', err);
    });
  }

  private handleReplayWebSocket(
    req: http.IncomingMessage,
    socket: Duplex,
  ): void {
    const url = req.url || '/';
    const key = `WS_${url.replaceAll('/', '_')}`;
    const filePath = getRecordingPath(this.recordingsDir, this.replayId!);

    loadRecordingSession(filePath)
      .then((session) => {
        const wsRecording = session.websocketRecordings.find(
          (r) => r.key === key,
        );

        if (!wsRecording) {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          console.log(`No WebSocket recording found for ${key}`);
          return;
        }

        // Create WebSocket server for replay
        const wss = new WebSocketServer({ noServer: true });

        // Fake upgrade request with proper headers
        const fakeReq = Object.assign(req, {
          headers: {
            ...req.headers,
            'sec-websocket-key':
              req.headers['sec-websocket-key'] || 'replay-key',
            'sec-websocket-version': '13',
          },
        });

        wss.handleUpgrade(fakeReq, socket, Buffer.alloc(0), (ws) => {
          console.log(`Replaying WebSocket: ${url}`);

          // Replay server-to-client messages
          const serverMessages = wsRecording.messages.filter(
            (m) => m.direction === 'server-to-client',
          );

          let messageIndex = 0;

          // Handle client messages and send corresponding server responses
          ws.on('message', (data) => {
            const clientMessage = data.toString();
            console.log(`Replay: Client sent: ${clientMessage}`);

            // Send next server message if available
            if (messageIndex < serverMessages.length) {
              setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(serverMessages[messageIndex].data);
                  console.log(`Replay: Sent server message ${messageIndex}`);
                  messageIndex++;
                }
              }, 10);
            }
          });

          // Send initial server messages (those sent before any client message)
          let initialMessagesSent = 0;
          for (let i = 0; i < wsRecording.messages.length; i++) {
            const msg = wsRecording.messages[i];
            if (msg.direction === 'client-to-server') {
              break;
            }
            if (msg.direction === 'server-to-client') {
              setTimeout(
                () => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(msg.data);
                    console.log(
                      `Replay: Sent initial server message: ${msg.data}`,
                    );
                    messageIndex++;
                    initialMessagesSent++;
                  }
                },
                10 * (initialMessagesSent + 1),
              );
            }
          }

          ws.on('error', (err) => {
            console.error('Replay WebSocket error:', err);
          });

          ws.on('close', () => {
            console.log('Replay WebSocket closed');
          });
        });
      })
      .catch((error) => {
        console.error('Replay error:', error);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      });
  }

  private logServerStartup(port: number): void {
    console.log(`Proxy server running on http://localhost:${port}`);
    console.log(`Mode: ${this.mode}`);
    console.log(`Targets: ${this.targets.join(', ')}`);
    console.log(
      `Control endpoint: http://localhost:${port}${CONTROL_ENDPOINT}`,
    );
  }
}
