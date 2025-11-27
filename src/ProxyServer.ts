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

/**
 * State for a single replay session
 * Allows multiple concurrent test runners to replay different recordings simultaneously
 */
interface ReplaySessionState {
  recordingId: string;
  servedRecordingIdsByKey: Map<string, Set<number>>;
  loadedSession: RecordingSession | null;
  lastAccessTime: number;
}

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
  private recordingIdCounter: number; // Unique ID for each recording entry
  private replaySessions: Map<string, ReplaySessionState>; // Track multiple concurrent replay sessions by recording ID

  constructor(targets: string[], recordingsDir: string) {
    this.targets = targets;
    // TODO: not used?
    this.currentTargetIndex = 0;
    this.mode = Modes.transparent;
    this.recordingId = null;
    this.recordingIdCounter = 0;
    this.replayId = null;
    this.modeTimeout = null;
    this.currentSession = null;
    this.recordingsDir = recordingsDir;
    this.replaySessions = new Map();
    this.proxy = httpProxy.createProxyServer({
      secure: false,
      changeOrigin: true,
      ws: true,
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

  /**
   * Extract recording ID from request cookie
   * Used for concurrent replay session routing
   * @param req The incoming HTTP request
   * @returns The recording ID from cookie, or null if not found
   */
  private getRecordingIdFromCookie(req: http.IncomingMessage): string | null {
    const cookies = req.headers.cookie;
    if (!cookies) {
      return null;
    }

    const match = cookies.match(/proxy-recording-id=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Get or create a replay session state for a given recording ID
   * @param recordingId The recording ID to get/create session for
   * @returns The replay session state
   */
  private getOrCreateReplaySession(recordingId: string): ReplaySessionState {
    let session = this.replaySessions.get(recordingId);

    if (session) {
      session.lastAccessTime = Date.now();
    } else {
      session = {
        recordingId,
        servedRecordingIdsByKey: new Map(),
        loadedSession: null,
        lastAccessTime: Date.now(),
      };
      this.replaySessions.set(recordingId, session);
      console.log(
        `[CONCURRENT REPLAY] Created new session for recording: ${recordingId}`,
      );
    }

    return session;
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
      } else if (req.method === 'POST') {
        const body = await readRequestBody(req);
        console.log(`MODE CHANGE (${req.method})`, body);
        data = JSON.parse(body);
      } else {
        return;
      }

      const { mode, id, timeout: requestTimeout } = data;
      const timeout = requestTimeout ?? DEFAULT_TIMEOUT_MS;

      this.clearModeTimeout();
      await this.switchMode(mode, id);
      this.setupModeTimeout(timeout);

      // Set cookie for replay mode to enable concurrent session routing
      if (mode === Modes.replay && id) {
        res.setHeader(
          'Set-Cookie',
          `proxy-recording-id=${encodeURIComponent(id)}; HttpOnly; Path=/; SameSite=Lax`,
        );
        console.log(`[CONCURRENT REPLAY] Set cookie for recording: ${id}`);
      }

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
    clearTimeout(this.modeTimeout || 0);
    this.modeTimeout = null;
  }

  private async switchMode(mode: Mode, id?: string): Promise<void> {
    console.log(`Switching to ${mode.toUpperCase()} mode`);

    // Save current session before switching
    if (this.currentSession && this.mode === Modes.record) {
      await this.saveCurrentSession(true);
      console.log('Session saved, continuing with mode switch');
    }

    switch (mode) {
      case Modes.transparent: {
        this.switchToTransparentMode();

        break;
      }
      case Modes.record: {
        if (!id) {
          throw new Error('Record ID is required');
        }
        this.switchToRecordMode(id);

        break;
      }
      case Modes.replay: {
        if (!id) {
          throw new Error('Replay ID is required');
        }
        await this.switchToReplayMode(id);

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

  private switchToRecordMode(id: string): void {
    this.mode = Modes.record;
    this.recordingId = id;
    this.replayId = null;
    this.currentSession = { id, recordings: [], websocketRecordings: [] };
    console.log(`Switched to record mode with ID: ${id}`);
  }

  private async switchToReplayMode(id: string): Promise<void> {
    this.mode = Modes.replay;
    this.replayId = id;
    this.recordingId = null;
    this.currentSession = null;

    // Reset the replay session to start fresh
    // This ensures served recordings tracker is cleared when re-entering replay mode
    const session = this.replaySessions.get(id);
    if (session) {
      session.servedRecordingIdsByKey.clear();
      console.log(`Reset served recordings tracker for session: ${id}`);
    } else {
      this.getOrCreateReplaySession(id);
    }

    console.log(`Switched to replay mode with ID: ${id}`);
  }

  private setupModeTimeout(timeout: number): void {
    this.modeTimeout = setTimeout(async () => {
      console.log('Timeout reached, switching back to transparent mode');
      await this.saveCurrentSession(true);
      this.switchToTransparentMode();
      this.modeTimeout = null;
    }, timeout);
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

    // Assign a unique ID to this recording
    // Store it both on the request object (for quick access) and in the recording (for persistence)
    const recordingId = this.recordingIdCounter++;
    (req as any).__recordingId = recordingId;

    const record: Recording = {
      request: {
        method: req.method!,
        url: req.url!,
        headers: req.headers,
        body: body || null,
      },
      timestamp: new Date().toISOString(),
      key,
      recordingId,
    };

    this.currentSession.recordings.push(record);
    console.log(
      // eslint-disable-next-line sonarjs/no-nested-template-literals
      `saveRequestRecordSync: Saved ${req.method} ${req.url} (key: ${key}, recordingId: ${recordingId}, body: ${body ? `${body.length} chars` : 'null'}, total: ${this.currentSession.recordings.length}, sessionId: ${this.currentSession.id})`,
    );
  }

  private updateRequestBodySync(req: http.IncomingMessage, body: string): void {
    if (!this.currentSession) {
      return;
    }

    const recordingId = (req as any).__recordingId;
    if (recordingId === undefined) {
      console.error(
        `updateRequestBodySync: No recording ID found on request ${req.method} ${req.url}`,
      );
      return;
    }

    // Find the exact recording by its unique ID
    const record = this.currentSession.recordings.find(
      (r) => r.recordingId === recordingId,
    );

    if (!record) {
      console.error(
        `updateRequestBodySync: Could not find recording with ID ${recordingId} for ${req.method} ${req.url}`,
      );
      return;
    }

    // Update the body
    record.request.body = body || null;
    console.log(
      `updateRequestBodySync: Updated body for ${req.method} ${req.url} (${body.length} chars, recordingId: ${recordingId})`,
    );
  }

  private async recordResponse(
    req: http.IncomingMessage,
    proxyRes: http.IncomingMessage,
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const recordingId = (req as any).__recordingId;
    if (recordingId === undefined) {
      console.error(
        `recordResponse: No recording ID found on request ${req.method} ${req.url}`,
      );
      return;
    }

    // Find the exact recording by its unique ID
    const record = this.currentSession.recordings.find(
      (r) => r.recordingId === recordingId,
    );

    if (!record) {
      console.error(
        `recordResponse: Could not find recording with ID ${recordingId} for ${req.method} ${req.url}`,
      );
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

      console.log(
        `Recorded: ${req.method} ${req.url} (recordingId: ${recordingId})`,
      );
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

    const recordingId = (req as any).__recordingId;
    if (recordingId === undefined) {
      console.error(
        `recordResponseData: No recording ID found on request ${req.method} ${req.url}`,
      );
      return false;
    }

    // Find the exact recording by its unique ID
    const record = this.currentSession.recordings.find(
      (r) => r.recordingId === recordingId,
    );

    if (!record) {
      console.error(
        `recordResponseData: Could not find recording with ID ${recordingId} for ${req.method} ${req.url}`,
      );
      return false;
    }

    record.response = {
      statusCode: proxyRes.statusCode!,
      headers: proxyRes.headers,
      body: body || null,
    };

    console.log(
      `recordResponseData: Recorded response for ${req.method} ${req.url} (recordingId: ${recordingId})`,
    );
    return true;
  }

  private async handleReplayRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Get recording ID from cookie, fallback to this.replayId for backward compatibility
    const recordingId = this.getRecordingIdFromCookie(req) || this.replayId;

    if (!recordingId) {
      const corsHeaders = this.getCorsHeaders(req);
      res.writeHead(HTTP_STATUS_BAD_REQUEST, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: 'No replay session active' }));
      return;
    }

    const key = getReqID(req);
    const filePath = getRecordingPath(this.recordingsDir, recordingId);

    try {
      // Get or create session state
      const sessionState = this.getOrCreateReplaySession(recordingId);

      // Load recording session if not already loaded
      if (!sessionState.loadedSession) {
        sessionState.loadedSession = await loadRecordingSession(filePath);
        console.log(`[REPLAY] Loaded recording session: ${recordingId}`);
      }

      const session = sessionState.loadedSession;

      // Get or create the set of served recording IDs for this endpoint
      if (!sessionState.servedRecordingIdsByKey.has(key)) {
        sessionState.servedRecordingIdsByKey.set(key, new Set());
      }
      const servedForThisKey = sessionState.servedRecordingIdsByKey.get(key)!;

      const host = req.headers.host || 'unknown';

      // Find all recordings with matching key that have responses
      const recordsWithKey = session.recordings
        .filter((r) => r.key === key && r.response)
        .toSorted((a, b) => a.recordingId - b.recordingId);

      if (recordsWithKey.length === 0) {
        const errorMsg = `No recording found for ${key} at ${req.method} ${host}${req.url}`;
        console.error(`[REPLAY ERROR] ${errorMsg} (session: ${recordingId})`);
        console.error(
          `[REPLAY ERROR] This request was not made during recording - possible test non-determinism`,
        );

        const errorResponse = {
          error: 'No recording found',
          message: errorMsg,
          key,
          sessionId: recordingId,
        };

        const corsHeaders = this.getCorsHeaders(req);
        res.writeHead(HTTP_STATUS_NOT_FOUND, {
          'Content-Type': 'application/json',
          ...corsHeaders,
        });
        res.end(JSON.stringify(errorResponse));
        return;
      }

      // Log incoming request details
      const requestCount = servedForThisKey.size + 1;
      console.log(
        `[REPLAY REQUEST #${requestCount}] ${req.method} ${req.url} (session: ${recordingId}, total: ${recordsWithKey.length}, served: ${servedForThisKey.size})`,
      );

      // Find the first unserved response for this endpoint (in recordingId order)
      let record: (typeof recordsWithKey)[number] | undefined;

      for (const rec of recordsWithKey) {
        if (!servedForThisKey.has(rec.recordingId)) {
          record = rec;
          break;
        }
      }

      // If all have been served, use the last one
      if (!record) {
        console.log(
          `[REPLAY WARNING] All ${recordsWithKey.length} recordings already served for ${key} (session: ${recordingId}), reusing last one`,
        );
        record = recordsWithKey[recordsWithKey.length - 1];
      }

      // Mark this recording as served for this endpoint
      servedForThisKey.add(record.recordingId);

      console.log(
        `[REPLAY SERVING] recordingId: ${record.recordingId}, session: ${recordingId}, body_len: ${record.response?.body?.length || 0}`,
      );

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

  // TODO: check if can handle streaming requests
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

          const responseHeaders = {
            ...proxyRes.headers,
            ...this.getCorsHeaders(req),
          };

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
