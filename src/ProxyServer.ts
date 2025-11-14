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
    req: http.IncomingMessage,
    res: unknown,
  ): void {
    console.error('Proxy error:', err);

    if (!(res instanceof http.ServerResponse)) {
      return;
    }

    if (!res.headersSent) {
      const corsHeaders = this.getCorsHeaders(req);
      res.writeHead(HTTP_STATUS_BAD_GATEWAY, {
        'Content-Type': 'application/json',
        ...corsHeaders,
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

  /**
   * Get CORS headers for a given request
   * @param req The incoming HTTP request
   * @returns An object containing CORS headers
   */
  private getCorsHeaders(req: http.IncomingMessage): Record<string, string> {
    const origin = req.headers.origin;

    return {
      'access-control-allow-origin': origin || '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers':
        req.headers['access-control-request-headers'] ||
        'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'access-control-expose-headers': '*',
    };
  }

  private addCorsHeaders(
    proxyRes: http.IncomingMessage,
    req: http.IncomingMessage,
  ): void {
    const corsHeaders = this.getCorsHeaders(req);
    Object.assign(proxyRes.headers, corsHeaders);
  }

  private getTarget(): string {
    const target = this.targets[this.currentTargetIndex];
    this.currentTargetIndex =
      (this.currentTargetIndex + 1) % this.targets.length;
    return target;
  }

  private parseGetParams(req: http.IncomingMessage) {
    // Parse query parameters from URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const mode = url.searchParams.get('mode') as Mode | null;
    const id = url.searchParams.get('id') || undefined;
    const timeoutParam = url.searchParams.get('timeout');
    const timeout = timeoutParam
      ? Number.parseInt(timeoutParam, 10)
      : undefined;

    if (!mode) {
      throw new Error('Mode parameter is required');
    }

    return { mode, id, timeout };
  }

  private async handleControlRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      let data: ControlRequest;

      // Support both GET with query parameters and POST with JSON body
      if (req.method === 'GET') {
        data = this.parseGetParams(req);
      } else {
        // POST request with JSON body
        const body = await readRequestBody(req);
        console.log('MODE CHANGE (POST)', body);
        data = JSON.parse(body);
      }

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
      await this.saveCurrentSession(true); // Filter incomplete recordings when switching modes
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
        await this.saveCurrentSession(true); // Filter incomplete recordings when timeout triggers mode switch
        this.switchToTransparentMode();
        this.modeTimeout = null;
      }, timeout);
    }
  }

  private async saveCurrentSession(
    filterIncomplete: boolean = false,
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // Only filter out incomplete recordings when explicitly requested (e.g., when switching modes)
    // During recording, we keep incomplete recordings to support concurrent requests
    if (filterIncomplete) {
      const incompleteCount = this.currentSession.recordings.filter(
        (r) => !r.response,
      ).length;

      if (incompleteCount > 0) {
        this.currentSession.recordings = this.currentSession.recordings.filter(
          (r) => r.response,
        );
      }
    }

    console.log(
      `Saving session with ${this.currentSession.recordings.length} HTTP and ${this.currentSession.websocketRecordings.length} WebSocket recordings`,
    );
    await saveRecordingSession(this.recordingsDir, this.currentSession);
  }

  private saveRequestRecordSync(
    req: http.IncomingMessage,
    body: string | null,
  ): void {
    if (!this.currentSession) {
      return;
    }

    const key = getReqID(req);

    // Don't assign sequence number yet - it will be assigned when response arrives
    const record: Recording = {
      request: {
        method: req.method!,
        url: req.url!,
        headers: req.headers,
        body: body || null,
      },
      timestamp: new Date().toISOString(),
      key,
      sequence: -1, // Temporary, will be set when response arrives
    };

    this.currentSession.recordings.push(record);
    console.log(
      // eslint-disable-next-line sonarjs/no-nested-template-literals
      `saveRequestRecordSync: Saved ${req.method} ${req.url} (key: ${key}, body: ${body ? `${body.length} chars` : 'null'}, total: ${this.currentSession.recordings.length}, sessionId: ${this.currentSession.id})`,
    );
  }

  private updateRequestBodySync(req: http.IncomingMessage, body: string): void {
    if (!this.currentSession) {
      return;
    }

    const key = getReqID(req);

    // Find the most recent record with this key that doesn't have a response yet
    const record = this.currentSession.recordings.findLast(
      (r) => r.key === key && !r.response,
    );

    if (!record) {
      console.error(
        `updateRequestBodySync: Could not find request record for ${req.method} ${req.url}`,
      );
      return;
    }

    // Update the body
    record.request.body = body || null;
    console.log(
      `updateRequestBodySync: Updated body for ${req.method} ${req.url} (${body.length} chars)`,
    );
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

      console.log(`Recorded: ${req.method} ${req.url}`);
    });
  }

  private async recordResponseData(
    req: http.IncomingMessage,
    proxyRes: http.IncomingMessage,
    body: string,
  ): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const key = getReqID(req);
    // Find the most recent record with this key that doesn't have a response yet
    const record = this.currentSession.recordings.findLast(
      (r) => r.key === key && !r.response,
    );

    if (!record) {
      const host = req.headers.host || 'unknown';
      const recordsWithKey = this.currentSession.recordings.filter(
        (r) => r.key === key,
      );

      console.error(
        `Request record not found for response: ${key} at ${req.method} ${host}${req.url}`,
      );
      console.error(
        `  Total recordings: ${this.currentSession.recordings.length}, with this key: ${recordsWithKey.length}`,
      );
      console.error(
        `  Records with key:`,
        recordsWithKey.map((r) => ({
          seq: r.sequence,
          hasResponse: !!r.response,
        })),
      );
      return false;
    }

    record.response = {
      statusCode: proxyRes.statusCode!,
      headers: proxyRes.headers,
      body: body || null,
    };

    // Update timestamp to reflect when the response was actually received
    record.timestamp = new Date().toISOString();

    // Assign sequence number based on response arrival order
    // This ensures sequence reflects the order responses were received
    const currentSequence = this.requestSequenceMap.get(key) || 0;
    record.sequence = currentSequence;
    this.requestSequenceMap.set(key, currentSequence + 1);

    console.log(
      `recordResponseData: Recorded response for ${req.method} ${req.url} (seq: ${record.sequence})`,
    );
    return true;
  }

  private async handleReplayRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const key = getReqID(req);
    const filePath = getRecordingPath(this.recordingsDir, this.replayId!);

    try {
      const session = await loadRecordingSession(filePath);

      const host = req.headers.host || 'unknown';

      // Find all recordings with matching key that have responses
      const recordsWithKey = session.recordings
        .filter((r) => r.key === key && r.response)
        .toSorted((a, b) => a.sequence - b.sequence);

      if (recordsWithKey.length === 0) {
        throw new Error(
          `No recording found for ${key} at ${req.method} ${host}${req.url}`,
        );
      }

      // Get or initialize the usage count for this key
      const usageCount = this.replaySequenceMap.get(key) || 0;

      // Always use sequential replay to ensure requests are replayed in the same order
      // they were recorded, preserving state changes (e.g., before/after POST operations)
      const recordIndex = usageCount % recordsWithKey.length;
      const record = recordsWithKey[recordIndex];

      console.log(
        `Replaying ${req.method} ${req.url} (usage: ${usageCount}, sequence: ${record.sequence}, body_len: ${record.response?.body?.length || 0})`,
      );

      // Increment usage count for next request with same key
      this.replaySequenceMap.set(key, usageCount + 1);

      if (!record.response) {
        throw new Error(
          `No response recorded for this request: ${req.method} ${host}${req.url}`,
        );
      }

      const { statusCode, headers, body } = record.response;

      // Add CORS headers to replay response
      const responseHeaders = {
        ...headers,
        ...this.getCorsHeaders(req),
      };

      res.writeHead(statusCode, responseHeaders);
      res.end(body);
    } catch (error) {
      this.handleReplayError(req, res, error, key, filePath);
    }
  }

  private handleReplayError(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    err: unknown,
    key: string,
    filePath: string,
  ): void {
    const isFileNotFound =
      err instanceof Error && 'code' in err && err.code === 'ENOENT';
    console.error('Replay error:', err);

    const corsHeaders = this.getCorsHeaders(req);
    res.writeHead(HTTP_STATUS_NOT_FOUND, {
      'Content-Type': 'application/json',
      ...corsHeaders,
    });
    res.end(
      JSON.stringify({
        error: isFileNotFound
          ? 'Recording file not found'
          : 'Recording not found',
        message: err instanceof Error ? err.message : 'Unknown error',
        key,
        filePath,
      }),
    );
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return this.handleCorsPreflightRequest(req, res);
    }

    // Check if URL starts with control endpoint (ignoring query parameters)
    const urlPath = req.url?.split('?')[0] || '';
    if (urlPath === CONTROL_ENDPOINT) {
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
    const corsHeaders = this.getCorsHeaders(req);

    res.writeHead(HTTP_STATUS_OK, {
      ...corsHeaders,
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
      // CRITICAL: Save request record IMMEDIATELY and SYNCHRONOUSLY before any async operations
      // This prevents race conditions with concurrent requests where responses might arrive
      // before request records are saved
      this.saveRequestRecordSync(req, null);

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
    // Note: Request record already saved in handleProxyRequest
    // Buffer the request body
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Wait for the request body to be fully buffered
    try {
      await new Promise<void>((resolve, reject) => {
        req.on('end', () => resolve());
        req.on('error', (err) => reject(err));
        // Add timeout to prevent hanging
        setTimeout(
          () => reject(new Error('Request buffering timeout')),
          30_000,
        );
      });
    } catch (error) {
      console.error('Error buffering request:', error);
      // Continue anyway - request record already exists
    }

    const body = Buffer.concat(chunks).toString('utf8');

    // Update the request record with the actual body
    this.updateRequestBodySync(req, body);

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

        // Buffer response data for recording
        const responseChunks: Buffer[] = [];

        proxyRes.on('data', (chunk: Buffer) => {
          responseChunks.push(chunk);
        });

        proxyRes.on('end', async () => {
          const responseBody = Buffer.concat(responseChunks);

          // Record the response
          const recorded = await this.recordResponseData(
            req,
            proxyRes,
            responseBody.toString('utf8'),
          );

          // Build response headers with CORS
          const responseHeaders = {
            ...proxyRes.headers,
            ...this.getCorsHeaders(req),
          };

          // Forward response to client with CORS headers
          res.writeHead(proxyRes.statusCode || 200, responseHeaders);
          res.end(responseBody);

          if (recorded) {
            console.log(`Recorded: ${req.method} ${req.url}`);
          }
        });

        proxyRes.on('error', (err) => {
          console.error('Proxy response error:', err);
          if (!res.headersSent) {
            this.handleProxyError(err, req, res);
          }
        });
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
