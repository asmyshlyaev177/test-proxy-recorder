import http from 'node:http';

export const Modes = {
  transparent: 'transparent',
  record: 'record',
  replay: 'replay',
} as const;

export type Mode = (typeof Modes)[keyof typeof Modes];

export interface ControlRequest {
  mode: Mode;
  id?: string;
  timeout?: number;
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
  sequence: number; // Sequence number for handling multiple requests to same endpoint
  recordingId: number; // Unique ID for matching responses to requests
}

export interface WebSocketMessage {
  direction: 'client-to-server' | 'server-to-client';
  data: string;
  timestamp: string;
}

export interface WebSocketRecording {
  url: string;
  messages: WebSocketMessage[];
  timestamp: string;
  key: string;
}

export interface RecordingSession {
  id: string;
  recordings: Recording[];
  websocketRecordings: WebSocketRecording[];
}
