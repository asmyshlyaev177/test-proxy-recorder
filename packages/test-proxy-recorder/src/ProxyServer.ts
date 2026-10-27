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

const noop = (): void => {};

interface RecordSessionState {
  session: RecordingSession;
  pending: Promise<Recording | null>[];
  recordingIdCounter: number;
  sequenceCounterByKey: Map<string, number>;
  // A cleanup runs beside the control chain, so two saves of one session can overlap and interleave their writes of one file.
  lastSave: Promise<void>;
  // Set when a retry's switch reuses the id: this attempt's state is never saved, the file belongs to the retry.
  replaced: boolean;
}

function createRecordSessionState(id: string): RecordSessionState {
  return {
    session: { id, recordings: [], websocketRecordings: [] },
    pending: [],
    recordingIdCounter: 0,
    sequenceCounterByKey: new Map(),
    lastSave: Promise.resolve(),
    replaced: false,
  };
}

async function flushSession(state: RecordSessionState): Promise<void> {
  // Calls that arrive while a batch settles join the next batch instead of being dropped.
  while (state.pending.length > 0) {
    const results = await Promise.allSettled(state.pending.splice(0));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        state.session.recordings.push(result.value);
      }
    }
  }
}

type ModeChange =
  | { mode: typeof Modes.transparent }
  | { mode: typeof Modes.record; id: string }
  | { mode: typeof Modes.replay; id: string };

const isMode = (value: string): value is Mode =>
  Object.values<string>(Modes).includes(value);

// Checked before anything changes, so a refused request leaves the running sessions and their timer alone.
function parseModeChange(
  mode: string | undefined,
  id: string | undefined,
): ModeChange {
  if (!mode) {
    throw new Error('Mode parameter is required when cleanup is not specified');
  }
  if (!isMode(mode)) {
    throw new Error('Invalid mode. Use: transparent, record, or replay');
  }
  if (mode === Modes.transparent) return { mode };
  if (!id) {
    throw new Error(
      mode === Modes.record ? 'Record ID is required' : 'Replay ID is required',
    );
  }
  return { mode, id };
}

type CallRoute =
  | { mode: typeof Modes.transparent }
  | { mode: typeof Modes.record; id: string }
  | { mode: typeof Modes.replay; id: string }
  | { mode: 'refused'; error: string; activeSessions: string[] };

type SessionRoute = Extract<CallRoute, { id: string }>;

export class ProxyServer {
  private target: string;
  // The last switch's mode and ids: what a call that names no session follows while no session is live.
  private mode: Mode;
  private recordingId: string | null;
  private replayId: string | null;
  private modeTimeout: NodeJS.Timeout | null;
  private proxy: httpProxy;
  private recordingsDir: string;
  private timeoutMs: number;
  private replaySessions: ReplaySessionManager; // Track multiple concurrent replay sessions by recording ID
  // Keyed by the session id each call carries, so several workers record through one proxy at once.
  private recordSessions = new Map<string, RecordSessionState>();
  // The mode each session was switched to, which the calls naming it follow.
  private sessionModes = new Map<string, Mode>();
  // Record switches minus cleanups, counted because a retry's switch can land before the earlier attempt's cleanup.
  // Above 0 the session is live; 0 is ended, kept across transparent so a stray call naming it passes through.
  private recordSwitchCounts = new Map<string, number>();
  private redaction?: RedactionConfig | false; // Secret-redaction config applied before saving (false/undefined = off)
  private redactBody: BodyRedactor;
  private wsReplay?: WebSocketReplayConfig; // WebSocket replay pacing
  private missingRecordings = new MissingRecordingNotifier();
  // Mode switches and the mode timer run one at a time: each saves files midway through changing the shared
  // mode and session maps, and a timer that fired mid-switch would end the sessions that switch started.
  private controlChain: Promise<void> = Promise.resolve();

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
    this.replayId = null;
    this.modeTimeout = null;
    this.recordingsDir = recordingsDir;
    this.replaySessions = new ReplaySessionManager(this.timeoutMs);
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

  private async cleanupSession(sessionId: string): Promise<void> {
    this.replaySessions.delete(sessionId);
    this.missingRecordings.reset(sessionId);

    // If this was the active replay session (legacy single-session mode), clear it
    if (this.replayId === sessionId) {
      this.replayId = null;
    }

    const switches = this.recordSwitchCounts.get(sessionId);
    if (switches !== undefined) {
      this.recordSwitchCounts.set(sessionId, Math.max(0, switches - 1));
    }
    // Kept and still recording the calls that name it: a stale cleanup from a retried attempt must not stop the retry.
    const recording = this.recordSessions.get(sessionId);
    if (recording) {
      await this.saveSession(recording);
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
        sessions: [...this.recordSessions.keys()],
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
      const { id } = data;

      if (data.cleanup && id) {
        // Outside the control chain: it touches only its own session, and one whose upstream never answers
        // must not hold up the other sessions' switches.
        await this.cleanupSession(id);
        sendJsonResponse(res, HTTP_STATUS_OK, {
          success: true,
          message: `Session ${id} cleaned up`,
          mode: this.mode,
        });
        return;
      }

      await this.runSerialized(() => this.applyModeChange(res, data));
    } catch (error) {
      console.error('Control request error:', error);
      sendJsonResponse(res, HTTP_STATUS_BAD_REQUEST, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async applyModeChange(
    res: http.ServerResponse,
    { mode, id, timeout: requestTimeout, websocket }: ControlRequest,
  ): Promise<void> {
    const change = parseModeChange(mode, id);
    const timeout = requestTimeout ?? this.timeoutMs;
    this.clearModeTimeout();
    try {
      await this.switchMode(change, websocket);
    } finally {
      // Validation ran above, so only a failed save lands here on error, and the sessions still recording keep a timer.
      if (this.mode !== Modes.transparent) this.setupModeTimeout(timeout);
    }

    if (change.mode === Modes.replay) {
      res.setHeader(
        'Set-Cookie',
        `proxy-recording-id=${encodeURIComponent(change.id)}; HttpOnly; Path=/; SameSite=Lax`,
      );
      console.log(`[CONCURRENT REPLAY] Set cookie for recording: ${change.id}`);
    }

    sendJsonResponse(res, HTTP_STATUS_OK, {
      success: true,
      mode: this.mode,
      id: this.recordingId || this.replayId,
      timeout,
      recordingsDir: this.recordingsDir,
    });
  }

  private runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.controlChain.then(operation);
    // The chain only orders the operations; each caller handles its own failure.
    this.controlChain = result.then(noop, noop);
    return result;
  }

  private clearModeTimeout(): void {
    clearTimeout(this.modeTimeout || 0);
    this.modeTimeout = null;
  }

  private async switchMode(
    change: ModeChange,
    websocket?: WebSocketReplayConfig,
  ): Promise<void> {
    console.log(`Switching to ${change.mode.toUpperCase()} mode`);
    switch (change.mode) {
      case Modes.transparent: {
        return this.switchToTransparentMode();
      }
      case Modes.record: {
        return this.switchToRecordMode(change.id);
      }
      case Modes.replay: {
        return this.switchToReplayMode(change.id, websocket);
      }
    }
  }

  private async switchToTransparentMode(): Promise<void> {
    // Ended before the saves: a call landing during a write passes through rather than joining a session whose
    // flush has finished, where it was answered and never saved; and the saves stop waiting on new calls.
    const sessions = [...this.recordSessions.values()];
    for (const id of this.recordSessions.keys()) {
      this.recordSwitchCounts.set(id, 0);
    }
    this.recordSessions.clear();
    this.sessionModes.clear();
    this.mode = Modes.transparent;
    this.recordingId = null;
    this.replayId = null;
    this.clearModeTimeout();
    console.log('Switched to transparent mode');

    const saves = await Promise.allSettled(
      sessions.map((state) => this.saveSession(state)),
    );
    const unsaved = sessions.filter(
      (_, index) => saves[index].status === 'rejected',
    );
    if (unsaved.length > 0) {
      throw new Error(
        `Could not save record sessions: ${unsaved.map((state) => state.session.id).join(', ')}`,
      );
    }
  }

  private switchToRecordMode(id: string): void {
    // A retry reuses the id and starts over; calls still pending on the old state resolve into it and are never saved.
    const replaced = this.recordSessions.get(id);
    if (replaced) replaced.replaced = true;
    this.recordSessions.set(id, createRecordSessionState(id));
    this.recordSwitchCounts.set(id, (this.recordSwitchCounts.get(id) ?? 0) + 1);
    this.sessionModes.set(id, Modes.record);
    this.mode = Modes.record;
    this.recordingId = id;
    this.replayId = null;
    console.log(`Switched to record mode with ID: ${id}`);
  }

  private async switchToReplayMode(
    id: string,
    websocket?: WebSocketReplayConfig,
  ): Promise<void> {
    // The session stops recording here, so what it recorded is the file it is about to replay.
    const recording = this.recordSessions.get(id);
    if (recording) {
      await this.saveSession(recording);
      this.recordSessions.delete(id);
    }

    this.recordSwitchCounts.set(id, 0);
    this.sessionModes.set(id, Modes.replay);
    this.mode = Modes.replay;
    this.replayId = id;
    this.recordingId = null;
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
    const timer = setTimeout(() => {
      this.runSerialized(async () => {
        // A switch that ran while this waited its turn armed a new timer; the session this one was set for is gone.
        if (this.modeTimeout !== timer) return;
        console.log('Timeout reached, switching back to transparent mode');
        await this.switchToTransparentMode();
      }).catch((error: unknown) => console.error('Mode timeout error:', error));
    }, timeout);
    this.modeTimeout = timer;
  }

  private saveSession(state: RecordSessionState): Promise<void> {
    const save = state.lastSave.then(async () => {
      await flushSession(state);
      if (state.replaced) return;
      await saveRecordingSession(
        this.recordingsDir,
        state.session,
        this.redaction,
      );
    });
    state.lastSave = save.then(noop, noop);
    return save;
  }

  // One place decides where a call goes: the session it names, else the one live session, else the last switch.
  private routeCall(req: http.IncomingMessage): CallRoute {
    const named = getRecordingIdFromRequest(req);
    if (named !== null) {
      const mode = this.sessionModes.get(named) ?? this.mode;
      return mode === Modes.transparent ? { mode } : { mode, id: named };
    }

    const live = this.getLiveSessions();
    if (live.length === 1) return live[0];
    if (live.length > 1) {
      const activeSessions = live.map(({ id }) => id);
      console.warn(
        `[CONCURRENT WARNING] ${req.method} ${req.url} is missing ${RECORDING_ID_HEADER} header/cookie. ` +
          `Active sessions: ${activeSessions.join(', ')}.`,
      );
      return {
        mode: 'refused',
        error: `Missing recording ID while several sessions are active. Ensure ${RECORDING_ID_HEADER} header is set (page.setExtraHTTPHeaders() may not apply to this request type).`,
        activeSessions,
      };
    }
    return this.routeToLastSwitch();
  }

  // A record session is live while its switches outnumber its cleanups, a replay session while cleanup or eviction has not dropped its state.
  private getLiveSessions(): SessionRoute[] {
    const recording = [...this.recordSessions.keys()]
      .filter((id) => (this.recordSwitchCounts.get(id) ?? 0) > 0)
      .map((id): SessionRoute => ({ mode: Modes.record, id }));
    const replaying = [...this.replaySessions.keys()]
      .filter((id) => this.sessionModes.get(id) === Modes.replay)
      .map((id): SessionRoute => ({ mode: Modes.replay, id }));
    return [...recording, ...replaying];
  }

  private routeToLastSwitch(): CallRoute {
    const { mode } = this;
    if (mode === Modes.transparent) return { mode };
    const id = mode === Modes.record ? this.recordingId : this.replayId;
    if (id === null) {
      return {
        mode: 'refused',
        error: `No ${mode} session active`,
        activeSessions: [],
      };
    }
    return { mode, id };
  }

  private sendRefusal(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    { error, activeSessions }: Extract<CallRoute, { mode: 'refused' }>,
  ): void {
    res.writeHead(HTTP_STATUS_BAD_REQUEST, {
      'Content-Type': 'application/json',
      ...getCorsHeaders(req),
    });
    res.end(JSON.stringify({ error, activeSessions }));
  }

  /** The record session a call is filed under, or null when this run already ended it and the call passes through. */
  private getRecordSession(
    req: http.IncomingMessage,
    id: string,
  ): RecordSessionState | null {
    const existing = this.recordSessions.get(id);
    if (existing) return existing;

    if (this.recordSwitchCounts.get(id) === 0) {
      console.warn(
        `[RECORD] ${req.method} ${req.url} names session ${id}, which this run already ended; passing it through unrecorded`,
      );
      return null;
    }

    console.warn(
      `[RECORD] ${req.method} ${req.url} names session ${id}, which no switch started; recording it under that id`,
    );
    const created = createRecordSessionState(id);
    this.recordSessions.set(id, created);
    return created;
  }

  private async handleReplayRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    recordingId: string,
  ): Promise<void> {
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

    const route = this.routeCall(req);
    switch (route.mode) {
      case 'refused': {
        return this.sendRefusal(req, res, route);
      }
      case Modes.replay: {
        return this.handleReplayRequest(req, res, route.id);
      }
      case Modes.record: {
        return this.recordAndProxy(req, res, route.id);
      }
      case Modes.transparent: {
        return this.passThrough(req, res);
      }
    }
  }

  private passThrough(req: http.IncomingMessage, res: http.ServerResponse) {
    console.log(`[transparent] ${req.method} ${req.url} -> ${this.target}`);
    this.proxy.web(req, res, { target: this.target });
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

  private recordAndProxy(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessionId: string,
  ): void {
    const state = this.getRecordSession(req, sessionId);
    if (!state) {
      this.passThrough(req, res);
      return;
    }

    console.log(`[record] ${req.method} ${req.url} -> ${this.target}`);
    const key = getReqID(req);
    const recordingId = state.recordingIdCounter++;
    const sequence = state.sequenceCounterByKey.get(key) ?? 0;
    state.sequenceCounterByKey.set(key, sequence + 1);

    // Pushed before the call settles, so the session keeps its calls in arrival order.
    state.pending.push(
      recordAndProxyRequest({
        req,
        res,
        target: this.target,
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
    // A browser handshake carries no recording-id header (setExtraHTTPHeaders skips the upgrade), only the
    // proxy-recording-id cookie the Playwright helper sets on the proxy origin.
    const route = this.routeCall(req);
    if (route.mode === 'refused') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    if (route.mode === Modes.replay) {
      this.handleReplayWebSocket(req, socket, route.id);
      return;
    }

    const target = this.target;
    const state =
      route.mode === Modes.record ? this.getRecordSession(req, route.id) : null;
    if (state) {
      console.log(`[record] WebSocket upgrade ${req.url} -> ${target}`);
      recordWebSocket(req, socket, head, target, state.session);
      return;
    }
    console.log(`[transparent] WebSocket upgrade ${req.url} -> ${target}`);
    this.proxy.ws(req, socket, head, { target });
  }

  private async handleReplayWebSocket(
    req: http.IncomingMessage,
    socket: Duplex,
    recordingId: string,
  ): Promise<void> {
    const key = getWsRecordingKey(req.url || '/');
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
