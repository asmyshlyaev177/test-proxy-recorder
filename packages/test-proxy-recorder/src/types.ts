import http from 'node:http';

export const Modes = {
  transparent: 'transparent',
  record: 'record',
  replay: 'replay',
} as const;

export type Mode = (typeof Modes)[keyof typeof Modes];

export interface ControlRequest {
  mode?: Mode;
  id?: string;
  timeout?: number;
  cleanup?: boolean; // When true, cleans up the session (unloads recording, resets counters)
  /** Per-session WebSocket replay pacing; overrides the proxy-level setting for this session. */
  websocket?: WebSocketReplayConfig;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string | null;
}

export interface RecordedResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string | null;
}

export interface Recording {
  request: RecordedRequest;
  response?: RecordedResponse;
  timestamp: string;
  key: string;
  sequence?: number; // Sequence number for same endpoint (0, 1, 2, ...)
  recordingId: number; // Unique ID for matching responses to requests
}

export interface WebSocketMessage {
  direction: 'client-to-server' | 'server-to-client';
  data: string;
  timestamp: string;
}

/** Replay-time pacing for recorded WebSocket messages. */
export interface WebSocketReplayConfig {
  /**
   * How recorded server→client messages are paced on replay.
   * - `'burst'` (default): sent immediately on connect — fastest, fully
   *   deterministic, best for CI.
   * - `'original'`: re-paced using the recorded timestamps, so messages arrive
   *   with their real inter-message gaps. A test then takes roughly the
   *   recording's wall-clock span.
   */
  timing?: 'burst' | 'original';
}

export interface WebSocketRecording {
  url: string;
  messages: WebSocketMessage[];
  timestamp: string;
  key: string;
  /** Client handshake headers (minus WebSocket internals like sec-websocket-key) */
  headers?: http.IncomingHttpHeaders;
  /** Subprotocol negotiated with the backend (from Sec-WebSocket-Protocol) */
  protocol?: string;
}

export interface RecordingSession {
  id: string;
  recordings: Recording[];
  websocketRecordings: WebSocketRecording[];
}
