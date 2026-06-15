import http from 'node:http';
import { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import type {
  RecordingSession,
  WebSocketMessage,
  WebSocketRecording,
  WebSocketReplayConfig,
} from './types.js';

/**
 * Recording key for a WebSocket URL
 */
export function getWsRecordingKey(url: string): string {
  return `WS_${url.replaceAll('/', '_')}`;
}

// WebSocket handshake internals that must not be recorded or forwarded —
// the ws client generates its own key/version, and connection/upgrade/host
// are hop-by-hop
const WS_INTERNAL_HEADERS = new Set([
  'host',
  'connection',
  'upgrade',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-extensions',
]);

/**
 * Headers worth persisting in a WebSocket recording: everything the client
 * sent except handshake internals. Keeps Sec-WebSocket-Protocol so the
 * recording shows which subprotocols were requested.
 */
function getRecordableWsHeaders(
  req: http.IncomingMessage,
): http.IncomingHttpHeaders {
  const headers: http.IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!WS_INTERNAL_HEADERS.has(name) && value !== undefined) {
      headers[name] = value;
    }
  }
  return headers;
}

/**
 * Headers to forward on the backend WebSocket connection in record mode.
 * Sec-WebSocket-Protocol is excluded because it is passed to the ws client
 * via the protocols argument instead.
 */
function getForwardableWsHeaders(
  req: http.IncomingMessage,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(getRecordableWsHeaders(req))) {
    if (name !== 'sec-websocket-protocol' && value !== undefined) {
      headers[name] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return headers;
}

/**
 * Subprotocols the client requested via Sec-WebSocket-Protocol, in order.
 */
function getClientSubprotocols(req: http.IncomingMessage): string[] {
  const header = req.headers['sec-websocket-protocol'];
  if (!header) {
    return [];
  }
  const raw = Array.isArray(header) ? header.join(',') : header;
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Record-mode WebSocket handler: proxies the connection to the backend
 * (forwarding handshake headers and subprotocols) while capturing all
 * messages into the current recording session.
 */
export function recordWebSocket(
  req: http.IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  target: string,
  session: RecordingSession | null,
): void {
  const url = req.url || '/';

  const wsRecording: WebSocketRecording = {
    url,
    messages: [],
    timestamp: new Date().toISOString(),
    key: getWsRecordingKey(url),
    headers: getRecordableWsHeaders(req),
  };

  if (session) {
    session.websocketRecordings.push(wsRecording);
  }

  // Create WebSocket connection to backend, forwarding the client's
  // subprotocols and handshake headers (auth tokens, cookies, custom
  // headers) so the backend sees the same handshake the client sent
  const backendWsUrl = `${target.replace('http', 'ws')}${url}`;
  const backendWs = new WebSocket(backendWsUrl, getClientSubprotocols(req), {
    headers: getForwardableWsHeaders(req),
  });

  // Create WebSocket server for client, answering with the subprotocol the
  // backend negotiated (the callback only runs when the client offered one)
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) =>
      backendWs.protocol && protocols.has(backendWs.protocol)
        ? backendWs.protocol
        : (protocols.values().next().value ?? false),
  });

  // Wait for backend connection before accepting client
  backendWs.on('open', () => {
    console.log(`WebSocket recording: connected to backend ${backendWsUrl}`);

    // Remember the subprotocol the backend negotiated so replay can answer
    // with the same one
    if (backendWs.protocol) {
      wsRecording.protocol = backendWs.protocol;
    }

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

/**
 * Cumulative offset (ms from the first message) at which each message in a run
 * should be sent, derived from the recorded timestamps. Each inter-message gap
 * uses the real recorded delay (floored at 0 to ignore out-of-order stamps).
 */
function cumulativeDelays(group: WebSocketMessage[]): number[] {
  const delays: number[] = [];
  let elapsed = 0;
  let prevTs: number | null = null;
  for (const msg of group) {
    const ts = Date.parse(msg.timestamp);
    if (prevTs !== null && !Number.isNaN(ts)) {
      elapsed += Math.max(0, ts - prevTs);
    }
    if (!Number.isNaN(ts)) {
      prevTs = ts;
    }
    delays.push(elapsed);
  }
  return delays;
}

/**
 * Schedule a run of consecutive recorded server messages with their original
 * timing: the first fires immediately, each later one after the real recorded
 * gap to its predecessor. Timers are tracked so they can be cancelled on close.
 */
function scheduleServerGroup(
  send: (data: string) => void,
  group: WebSocketMessage[],
  timers: Set<ReturnType<typeof setTimeout>>,
): void {
  const delays = cumulativeDelays(group);
  let index = 0;
  for (const msg of group) {
    const delay = delays[index];
    index++;
    if (delay <= 0) {
      send(msg.data);
      continue;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      send(msg.data);
    }, delay);
    timers.add(timer);
  }
}

/**
 * Drives a replay socket from a recorded message list. Walks the sequence with
 * a cursor: after each client message, serves the run of consecutive server
 * messages that followed it — immediately (`burst`) or re-paced from the
 * recorded timestamps (`original`).
 */
class ReplayPlayer {
  private cursor = 0;
  // Pending 'original'-timing timers, cleared on close so nothing is sent
  // after the socket goes away.
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly ws: WebSocket,
    private readonly messages: WebSocketMessage[],
    private readonly timing: 'burst' | 'original',
  ) {}

  /** Register socket handlers and serve any initial server messages. */
  start(): void {
    this.ws.on('message', (data) => {
      console.log(`Replay: Client sent: ${data.toString()}`);
      this.onClientMessage();
    });
    this.ws.on('error', (err) => {
      console.error('Replay WebSocket error:', err);
    });
    this.ws.on('close', () => this.dispose());

    // Initial server messages are those recorded before any client message,
    // e.g. a welcome message.
    this.flush();
  }

  private send(data: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private onClientMessage(): void {
    // Advance past the recorded client message, then serve what followed it.
    if (
      this.cursor < this.messages.length &&
      this.messages[this.cursor].direction === 'client-to-server'
    ) {
      this.cursor++;
    }
    this.flush();
  }

  private flush(): void {
    const group: WebSocketMessage[] = [];
    while (
      this.cursor < this.messages.length &&
      this.messages[this.cursor].direction === 'server-to-client'
    ) {
      group.push(this.messages[this.cursor]);
      this.cursor++;
    }
    if (group.length === 0) {
      return;
    }
    if (this.timing === 'burst') {
      for (const msg of group) {
        this.send(msg.data);
      }
    } else {
      scheduleServerGroup((data) => this.send(data), group, this.timers);
    }
  }

  private dispose(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    console.log('Replay WebSocket closed');
  }
}

/**
 * Replay-mode WebSocket handler: accepts the client connection (answering
 * with the recorded subprotocol) and serves the recorded message sequence.
 */
export function replayWebSocket(
  req: http.IncomingMessage,
  socket: Duplex,
  wsRecording: WebSocketRecording,
  recordingId: string,
  config?: WebSocketReplayConfig,
): void {
  const url = req.url || '/';
  const timing = config?.timing ?? 'burst';

  // Create WebSocket server for replay, answering with the recorded
  // subprotocol when the client offers it (callback only runs when the
  // client offered protocols)
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) =>
      wsRecording.protocol && protocols.has(wsRecording.protocol)
        ? wsRecording.protocol
        : (protocols.values().next().value ?? false),
  });

  // Fake upgrade request with proper headers
  const fakeReq = Object.assign(req, {
    headers: {
      ...req.headers,
      'sec-websocket-key': req.headers['sec-websocket-key'] || 'replay-key',
      'sec-websocket-version': '13',
    },
  });

  wss.handleUpgrade(fakeReq, socket, Buffer.alloc(0), (ws) => {
    console.log(
      `Replaying WebSocket: ${url} (session: ${recordingId}, timing: ${timing})`,
    );
    new ReplayPlayer(ws, wsRecording.messages, timing).start();
  });
}
