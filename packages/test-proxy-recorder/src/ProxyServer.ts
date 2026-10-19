import fs from 'node:fs/promises';
import http from 'node:http';
import { Duplex } from 'node:stream';

import httpProxy from 'http-proxy';

import {
  CONTROL_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  MISSING_RECORDING_ENDPOINT,
  RECORDING_ID_HEADER,
} from './constants.js';
import {
  recordAndProxyRequest,
  UPSTREAM_PROXY_OPTIONS,
} from './httpRecorder.js';
import { MissingRecordingNotifier } from './missingRecordings.js';
import {
  getRecordsForBody,
  getServedTracker,
  getSortedRecordings,
  ReplaySessionManager,
  type ReplaySessionState,
  selectReplayRecord,
} from './replaySessions.js';
import {
  type ControlRequest,
  type Mode,
  Modes,
  type RecordedResponse,
  type Recording,
  type RecordingSession,
  type WebSocketReplayConfig,
} from './types.js';
import { addCorsHeaders, getCorsHeaders } from './utils/cors.js';
import {
  findRecordingPath,
  getRecordingPath,
  loadRecordingSession,
  saveRecordingSession,
} from './utils/fileUtils.js';
import { getReqID } from './utils/getReqID';
import { readRequestBody, sendJsonResponse } from './utils/httpHelpers.js';
import { getRecordingIdFromRequest } from './utils/recordingId.js';
import {
  type BodyRedactor,
  createBodyRedactor,
  type RedactionConfig,
  serializeRedactionConfig,
} from './utils/redact.js';
import {
  getWsRecordingKey,
  recordWebSocket,
  replayWebSocket,
} from './websocketHandlers.js';

// GET and HEAD carry no body in practice, so they skip the read and match by recorded order alone.
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

/** The request body, '' for GET and HEAD, or null when the client went away while sending it. */
async function readBodyForMatching(
  req: http.IncomingMessage,
): Promise<string | null> {
  if (METHODS_WITHOUT_BODY.has(req.method ?? '')) return '';
  try {
    return await readRequestBody(req);
  } catch (error) {
    // A page that cancels an upload by navigating away has no missing recording.
    console.warn(
      `[REPLAY] ${req.method} ${req.url}: the client went away while sending its body`,
      error,
    );
    return null;
  }
}

/**
 * Body redaction rewrites the stored body but not its recorded content-length,
 * and a client waits for bytes that never come, so the length follows the body.
 */
function withReplayedContentLength(
  method: string | undefined,
  headers: http.IncomingHttpHeaders,
  body: string | null,
): http.IncomingHttpHeaders {
  // A HEAD response states the length of a body it never sends.
  if (method === 'HEAD') return headers;
  const lengthKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === 'content-length',
  );
  if (lengthKey === undefined) return headers;
  return { ...headers, [lengthKey]: String(Buffer.byteLength(body ?? '')) };
}

export class ProxyServer {
  private target: string;
  private mode: Mode;
  private recordingId: string | null;
  private replayId: string | null;
  private modeTimeout: NodeJS.Timeout | null;
  private proxy: httpProxy;
  private currentSession: RecordingSession | null;
  private recordingsDir: string;
  private timeoutMs: number;
  // Unique ID for each recording entry
  private recordingIdCounter: number;
  // Sequence counter per key (endpoint)
  private sequenceCounterByKey: Map<string, number>;
  private replaySessions: ReplaySessionManager; // Track multiple concurrent replay sessions by recording ID
  private recordingPromises: Promise<Recording | null>[]; // Stack of promises that resolve to completed recordings
  private flushPromise: Promise<void> | null; // Promise for in-progress flush operation
  private redaction?: RedactionConfig | false; // Secret-redaction config applied before saving (false/undefined = off)
  private redactBody: BodyRedactor;
  private wsReplay?: WebSocketReplayConfig; // WebSocket replay pacing
  private missingRecordings = new MissingRecordingNotifier();

  constructor(
    target: string,
    recordingsDir: string,
    timeoutMs?: number,
    redaction?: RedactionConfig | false,
    wsReplay?: WebSocketReplayConfig,
  ) {
    this.target = target;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.redaction = redaction;
    this.redactBody = createBodyRedactor(redaction);
    this.wsReplay = wsReplay;
    this.mode = Modes.transparent;
    this.recordingId = null;
    this.recordingIdCounter = 0;
    this.sequenceCounterByKey = new Map();
    this.replayId = null;
    this.modeTimeout = null;
    this.currentSession = null;
    this.recordingsDir = recordingsDir;
    this.replaySessions = new ReplaySessionManager(this.timeoutMs);
    this.recordingPromises = [];
    this.flushPromise = null;
    this.proxy = httpProxy.createProxyServer({
      ...UPSTREAM_PROXY_OPTIONS,
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
    this.proxy.on('proxyRes', addCorsHeaders);
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
      const corsHeaders = getCorsHeaders(req);
      res.writeHead(HTTP_STATUS_BAD_GATEWAY, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
    }

    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  }

  /**
   * Clean up a session - removes it from memory and resets counters
   * @param sessionId The session ID to clean up
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    this.replaySessions.delete(sessionId);
    this.missingRecordings.reset(sessionId);

    // If this was the active recording session, save it before clearing
    if (this.recordingId === sessionId) {
      await this.saveCurrentSession();
      this.currentSession = null;
      this.recordingId = null;
    }

    // If this was the active replay session (legacy single-session mode), clear it
    if (this.replayId === sessionId) {
      this.replayId = null;
    }

    console.log(`[CLEANUP] Session ${sessionId} cleaned up successfully`);
  }

  private async parseControlBody(
    req: http.IncomingMessage,
  ): Promise<ControlRequest> {
    const body = await readRequestBody(req);
    console.log(`MODE CHANGE (${req.method})`, body);
    return JSON.parse(body);
  }

  private async handleControlRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method === 'HEAD') {
      res.writeHead(HTTP_STATUS_OK);
      res.end();
      return;
    }
    if (req.method === 'GET') {
      sendJsonResponse(res, HTTP_STATUS_OK, {
        recordingsDir: this.recordingsDir,
        mode: this.mode,
        id: this.recordingId || this.replayId,
        redaction: serializeRedactionConfig(this.redaction),
      });
      return;
    }
    await this.handleControlPost(req, res);
  }

  private async handleControlPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      const data = await this.parseControlBody(req);
      const { mode, id, timeout: requestTimeout, cleanup, websocket } = data;

      if (cleanup && id) {
        await this.cleanupSession(id);
        sendJsonResponse(res, HTTP_STATUS_OK, {
          success: true,
          message: `Session ${id} cleaned up`,
          mode: this.mode,
        });
        return;
      }

      await this.applyModeChange(res, mode, id, requestTimeout, websocket);
    } catch (error) {
      console.error('Control request error:', error);
      sendJsonResponse(res, HTTP_STATUS_BAD_REQUEST, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async applyModeChange(
    res: http.ServerResponse,
    mode: Mode | undefined,
    id: string | undefined,
    requestTimeout: number | undefined,
    websocket: WebSocketReplayConfig | undefined,
  ): Promise<void> {
    if (!mode) {
      throw new Error(
        'Mode parameter is required when cleanup is not specified',
      );
    }

    const timeout = requestTimeout ?? this.timeoutMs;
    this.clearModeTimeout();
    await this.switchMode(mode, id, websocket);
    this.setupModeTimeout(timeout);

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
      recordingsDir: this.recordingsDir,
    });
  }

  private clearModeTimeout(): void {
    clearTimeout(this.modeTimeout || 0);
    this.modeTimeout = null;
  }

  private async switchMode(
    mode: Mode,
    id?: string,
    websocket?: WebSocketReplayConfig,
  ): Promise<void> {
    console.log(`Switching to ${mode.toUpperCase()} mode`);

    // Save current session before switching
    if (this.currentSession && this.mode === Modes.record) {
      await this.saveCurrentSession();
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
        await this.switchToReplayMode(id, websocket);

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
    this.clearModeTimeout();
    console.log('Switched to transparent mode');
  }

  private switchToRecordMode(id: string): void {
    this.mode = Modes.record;
    this.recordingId = id;
    this.replayId = null;
    this.currentSession = { id, recordings: [], websocketRecordings: [] };
    this.recordingIdCounter = 0; // Reset for new session
    this.sequenceCounterByKey.clear(); // Reset sequence counters for new session
    console.log(`Switched to record mode with ID: ${id}`);
  }

  private async switchToReplayMode(
    id: string,
    websocket?: WebSocketReplayConfig,
  ): Promise<void> {
    this.mode = Modes.replay;
    this.replayId = id;
    this.recordingId = null;
    this.currentSession = null;
    this.missingRecordings.reset(id);

    // Get or create the replay session
    const sessionState = this.replaySessions.getOrCreate(id);

    // Per-session pacing overrides the proxy-level setting for this session.
    sessionState.wsReplay = websocket;

    // Reset the replay session to start fresh
    // This ensures served recordings tracker is cleared when re-entering replay mode
    sessionState.servedRecordingIdsByKey.clear();
    sessionState.sortedRecordingsByKey.clear();
    sessionState.bodyIdentityByRecordingId.clear();

    // Load the session file immediately instead of on first request
    // If the file doesn't exist, we'll still switch to replay mode but requests will fail
    const filePath = await findRecordingPath(this.recordingsDir, id);
    try {
      sessionState.loadedSession = await loadRecordingSession(filePath);
      console.log(`[REPLAY] Loaded recording session: ${id}`);
    } catch (error) {
      console.error(`[REPLAY ERROR] Failed to load session ${id}:`, error);
      sessionState.loadedSession = null;
      // Don't throw - allow mode switch to succeed, but requests will fail with 404
    }

    console.log(`Switched to replay mode with ID: ${id}`);
  }

  private setupModeTimeout(timeout: number): void {
    this.clearModeTimeout();
    this.modeTimeout = setTimeout(async () => {
      console.log('Timeout reached, switching back to transparent mode');
      await this.saveCurrentSession();
      this.switchToTransparentMode();
      this.modeTimeout = null;
    }, timeout);
  }

  private async flushPendingRecordings(): Promise<void> {
    // If a flush is already in progress, wait for it to complete
    // This prevents concurrent flushes from processing the same promises twice
    if (this.flushPromise) {
      await this.flushPromise;
      return;
    }

    if (this.recordingPromises.length === 0) {
      return;
    }

    // Set the flush promise to prevent concurrent flushes
    this.flushPromise = (async () => {
      try {
        const results = await Promise.allSettled(this.recordingPromises);

        // Add completed recordings to current session in the order they were received
        if (this.currentSession) {
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              this.currentSession.recordings.push(result.value);
            }
          }
          console.log(
            `Flushed ${results.length} recordings to session (total: ${this.currentSession.recordings.length})`,
          );
        }

        // Clear the promises array
        this.recordingPromises = [];
      } finally {
        // Clear the flush promise to allow future flushes
        this.flushPromise = null;
      }
    })();

    await this.flushPromise;
  }

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    await this.flushPendingRecordings();

    console.log(
      `Saving session with ${this.currentSession.recordings.length} HTTP and ${this.currentSession.websocketRecordings.length} WebSocket recordings`,
    );
    await saveRecordingSession(
      this.recordingsDir,
      this.currentSession,
      this.redaction,
    );
  }

  private getRecordingIdOrError(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): string | null {
    const recordingIdFromRequest = getRecordingIdFromRequest(req);

    // If we have a recording ID from the request (header or cookie), use it
    if (recordingIdFromRequest) {
      return recordingIdFromRequest;
    }

    // Fallback to this.replayId only if there's exactly one active session (backward compatibility)
    // For concurrent sessions with multiple active sessions, we MUST NOT use this.replayId
    // as it can point to the wrong session (race condition)
    if (this.replaySessions.size > 1) {
      // In concurrent mode, if no recording ID is provided, we cannot determine
      // which session this request belongs to. Log the error and fail.
      console.warn(
        `[CONCURRENT REPLAY WARNING] Request to ${req.method} ${req.url} is missing ${RECORDING_ID_HEADER} header/cookie. ` +
          `Active sessions: ${[...this.replaySessions.keys()].join(', ')}. ` +
          `this.replayId fallback would be: ${this.replayId} (NOT USING - could be wrong session)`,
      );

      // Return error - we cannot safely determine which session to use
      const corsHeaders = getCorsHeaders(req);
      res.writeHead(HTTP_STATUS_BAD_REQUEST, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(
        JSON.stringify({
          error:
            'Missing recording ID in concurrent replay mode. Ensure x-test-rcrd-id header is set.',
          activeSessions: [...this.replaySessions.keys()],
          hint: 'This usually means page.setExtraHTTPHeaders() did not apply to this request type',
        }),
      );
      return null;
    }

    // Single session or no active sessions - use fallback for backward compatibility
    const recordingId = this.replayId;
    if (!recordingId) {
      const corsHeaders = getCorsHeaders(req);
      res.writeHead(HTTP_STATUS_BAD_REQUEST, {
        'Content-Type': 'application/json',
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: 'No replay session active' }));
      return null;
    }

    console.log(
      `[FALLBACK] Using replayId fallback for ${req.method} ${req.url} -> session: ${recordingId} (single session mode)`,
    );
    return recordingId;
  }

  private async handleReplayRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const recordingId = this.getRecordingIdOrError(req, res);
    if (!recordingId) return;

    // Read before any session state: nothing may await between picking a recording and marking it served.
    const requestBody = await readBodyForMatching(req);
    if (requestBody === null) return;

    const key = getReqID(req);
    const filePath = getRecordingPath(this.recordingsDir, recordingId);

    try {
      const sessionState = this.getLoadedSession(recordingId, filePath);
      const servedForThisKey = getServedTracker(sessionState, key);

      // Use cached sorted recordings to avoid re-filtering and re-sorting
      const recordsWithKey = getSortedRecordings(sessionState, key);
      const matching = this.getRecordsForRequest(
        req,
        sessionState,
        recordsWithKey,
        requestBody,
      );

      if (matching.length === 0) {
        this.sendNoRecordingFound(
          req,
          res,
          key,
          recordingId,
          recordsWithKey.length,
        );
        return;
      }

      const requestCount = servedForThisKey.size + 1;
      console.log(
        `[replay request #${requestCount}] ${req.method} ${req.url} (key: ${key}, session: ${recordingId}, total: ${recordsWithKey.length}, served: ${servedForThisKey.size})`,
      );

      const record = selectReplayRecord(
        matching,
        servedForThisKey,
        key,
        recordingId,
      );

      // Unreachable, as getSortedRecordings keeps only recordings with a response.
      if (!record?.response) {
        throw new Error(
          `No response recorded for this request: ${req.method} ${req.url}`,
        );
      }

      servedForThisKey.add(record.recordingId);
      console.log(
        `[replay serving] recordingId: ${record.recordingId}, session: ${recordingId}, body_len: ${record.response.body?.length || 0}`,
      );
      this.sendRecordedResponse(req, res, record.response);
    } catch (error) {
      this.missingRecordings.report(
        recordingId,
        `No recording for ${req.method} ${req.url} in session ${recordingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.handleReplayError(req, res, error, key, filePath);
    }
  }

  private sendRecordedResponse(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    { statusCode, headers, body }: RecordedResponse,
  ): void {
    res.writeHead(statusCode, {
      ...withReplayedContentLength(req.method, headers, body),
      ...getCorsHeaders(req),
    });
    res.end(body);
  }

  // Session is already loaded in switchToReplayMode (or load failed)
  private getLoadedSession(
    recordingId: string,
    filePath: string,
  ): ReplaySessionState {
    const sessionState = this.replaySessions.getOrCreate(recordingId);
    if (!sessionState.loadedSession) {
      throw Object.assign(
        new Error(`Recording session file not found: ${filePath}`),
        { code: 'ENOENT' },
      );
    }
    return sessionState;
  }

  private getRecordsForRequest(
    req: http.IncomingMessage,
    sessionState: ReplaySessionState,
    recordsWithKey: Recording[],
    requestBody: string,
  ): Recording[] {
    if (METHODS_WITHOUT_BODY.has(req.method ?? '')) return recordsWithKey;
    return getRecordsForBody(
      sessionState,
      recordsWithKey,
      requestBody,
      req.headers['content-type'],
      this.redactBody,
    );
  }

  private sendNoRecordingFound(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    key: string,
    recordingId: string,
    otherBodies: number,
  ): void {
    const host = req.headers.host || 'unknown';
    const withBody = otherBodies > 0 ? ' with this request body' : '';
    const others =
      otherBodies > 0 ? ` (${otherBodies} recorded with other bodies)` : '';
    const errorMsg = `No recording found for ${key} at ${req.method} ${host}${req.url}${withBody}${others}`;
    console.error(`[REPLAY ERROR] ${errorMsg} (session: ${recordingId})`);
    this.missingRecordings.report(
      recordingId,
      `No recording for ${req.method} ${req.url}${withBody} in session ${recordingId}${others}`,
    );
    console.error(
      otherBodies > 0
        ? '[REPLAY ERROR] The request body differs from every recording of this endpoint - re-record, or keep the body the same between runs (no current date or random id)'
        : '[REPLAY ERROR] This request was not made during recording - possible test non-determinism',
    );

    res.writeHead(HTTP_STATUS_NOT_FOUND, {
      'Content-Type': 'application/json',
      ...getCorsHeaders(req),
    });
    res.end(
      JSON.stringify({
        error: 'No recording found',
        message: errorMsg,
        key,
        sessionId: recordingId,
      }),
    );
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

    const corsHeaders = getCorsHeaders(req);
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
    if (urlPath === MISSING_RECORDING_ENDPOINT) {
      return this.handleMissingRecordingPoll(req, res);
    }

    if (this.mode === Modes.replay) {
      return this.handleReplayRequest(req, res);
    }

    await this.handleProxyRequest(req, res);
  }

  private handleMissingRecordingPoll(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const id = new URLSearchParams(req.url?.split('?')[1] ?? '').get('id');
    if (!id) {
      sendJsonResponse(res, HTTP_STATUS_BAD_REQUEST, {
        error: 'Missing id query parameter',
      });
      return;
    }
    this.missingRecordings.wait(id, res);
  }

  private handleCorsPreflightRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const corsHeaders = getCorsHeaders(req);

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
    const target = this.target;
    console.log(`[${this.mode}] ${req.method} ${req.url} -> ${target}`);

    if (this.mode === Modes.record) {
      this.recordAndProxy(req, res, target);
    } else {
      this.proxy.web(req, res, { target });
    }
  }

  private recordAndProxy(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: string,
  ): void {
    if (!this.currentSession) {
      return;
    }

    const key = getReqID(req);
    const recordingId = this.recordingIdCounter++;
    const sequence = this.sequenceCounterByKey.get(key) || 0;
    this.sequenceCounterByKey.set(key, sequence + 1);

    // Add promise to stack immediately - this preserves request order!
    this.recordingPromises.push(
      recordAndProxyRequest({
        req,
        res,
        target,
        key,
        recordingId,
        sequence,
        onProxyError: this.handleProxyError.bind(this),
      }),
    );
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

    const target = this.target;
    console.log(`[${this.mode}] WebSocket upgrade ${req.url} -> ${target}`);

    if (this.mode === Modes.record) {
      recordWebSocket(req, socket, head, target, this.currentSession);
    } else {
      // Transparent mode - just proxy through
      this.proxy.ws(req, socket, head, { target });
    }
  }

  /**
   * Resolve the recording ID for a WebSocket upgrade request.
   * Mirrors getRecordingIdOrError(): prefer the header/cookie from the request,
   * fall back to this.replayId only when there is at most one active session.
   * On a browser WebSocket handshake the recording-id *header* does not arrive:
   * page.route() can't intercept the upgrade, and setExtraHTTPHeaders does not
   * propagate to it. The `proxy-recording-id` cookie (set on the proxy origin by
   * playwrightProxy.before) does ride along, so for concurrent WS replay the
   * cookie is the only channel that carries the session id.
   */
  private getWsRecordingId(req: http.IncomingMessage): string | null {
    const fromRequest = getRecordingIdFromRequest(req);
    if (fromRequest) {
      return fromRequest;
    }

    if (this.replaySessions.size > 1) {
      console.warn(
        `[CONCURRENT REPLAY WARNING] WebSocket upgrade ${req.url} is missing ${RECORDING_ID_HEADER} header/cookie. ` +
          `Active sessions: ${[...this.replaySessions.keys()].join(', ')}. ` +
          `this.replayId fallback would be: ${this.replayId} (NOT USING - could be wrong session)`,
      );
      return null;
    }

    return this.replayId;
  }

  private async handleReplayWebSocket(
    req: http.IncomingMessage,
    socket: Duplex,
  ): Promise<void> {
    const key = getWsRecordingKey(req.url || '/');

    const recordingId = this.getWsRecordingId(req);
    if (!recordingId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      // Reuse the cached session state instead of re-reading the file on
      // every upgrade
      const sessionState = this.replaySessions.getOrCreate(recordingId);
      if (!sessionState.loadedSession) {
        const filePath = await findRecordingPath(
          this.recordingsDir,
          recordingId,
        );
        sessionState.loadedSession = await loadRecordingSession(filePath);
      }

      const wsRecording = sessionState.loadedSession.websocketRecordings.find(
        (r) => r.key === key,
      );

      if (!wsRecording) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        console.log(`No WebSocket recording found for ${key}`);
        return;
      }

      replayWebSocket(
        req,
        socket,
        wsRecording,
        sessionState.wsReplay ?? this.wsReplay,
      );
    } catch (error) {
      console.error('Replay error:', error);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  }

  private logServerStartup(port: number): void {
    console.log(`Proxy server running on http://localhost:${port}`);
    console.log(`Mode: ${this.mode}`);
    console.log(`Target: ${this.target}`);
    console.log(
      `Control endpoint: http://localhost:${port}${CONTROL_ENDPOINT}`,
    );
  }
}
