import http from 'node:http';
import { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import type { RecordingSession, WebSocketRecording } from './types.js';

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
 * Replay-mode WebSocket handler: accepts the client connection (answering
 * with the recorded subprotocol) and serves the recorded message sequence.
 */
export function replayWebSocket(
  req: http.IncomingMessage,
  socket: Duplex,
  wsRecording: WebSocketRecording,
  recordingId: string,
): void {
  const url = req.url || '/';

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
    console.log(`Replaying WebSocket: ${url} (session: ${recordingId})`);

    // Walk the recorded message sequence with a cursor. After each client
    // message, send every consecutive server message that followed it in
    // the recording. This preserves recorded order and supports many
    // server messages per client message (e.g. high-frequency bursts).
    const messages = wsRecording.messages;
    let cursor = 0;

    const flushServerMessages = () => {
      while (
        cursor < messages.length &&
        messages[cursor].direction === 'server-to-client'
      ) {
        const msg = messages[cursor];
        cursor++;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg.data);
        }
      }
    };

    ws.on('message', (data) => {
      console.log(`Replay: Client sent: ${data.toString()}`);

      // Advance past the recorded client message, then send the server
      // messages that followed it
      if (
        cursor < messages.length &&
        messages[cursor].direction === 'client-to-server'
      ) {
        cursor++;
      }
      flushServerMessages();
    });

    ws.on('error', (err) => {
      console.error('Replay WebSocket error:', err);
    });

    ws.on('close', () => {
      console.log('Replay WebSocket closed');
    });

    // Send initial server messages (those recorded before any client
    // message, e.g. a welcome message)
    flushServerMessages();
  });
}
