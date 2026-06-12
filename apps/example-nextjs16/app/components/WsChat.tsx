'use client';

import { useEffect, useRef, useState } from 'react';

// NOTE: NEXT_PUBLIC_API_URL is baked in at build time.
// Dev/test: point to the proxy (e.g. http://localhost:8100) so WebSocket traffic is recorded.
// Production: point to the real backend URL.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100';
const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws/chat`;

interface LogEntry {
  direction: 'sent' | 'received';
  text: string;
}

interface ServerMessage {
  type: string;
  message?: string;
  text?: string;
  sentAt?: string | null;
  serverId?: string;
  index?: number;
  payload?: string;
  count?: number;
  protocol?: string | null;
}

function formatServerMessage(msg: ServerMessage): string {
  switch (msg.type) {
    case 'welcome':
      return msg.protocol
        ? `${msg.message} (protocol: ${msg.protocol})`
        : (msg.message ?? 'welcome');
    case 'reply':
      return msg.sentAt ? `${msg.text} (sent at ${msg.sentAt})` : (msg.text ?? '');
    case 'burst-item':
      return `burst ${msg.index}: ${msg.payload}`;
    case 'burst-end':
      return `burst finished: ${msg.count} messages`;
    default:
      return JSON.stringify(msg);
  }
}

export default function WsChat() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    // Browsers can't set custom headers on WebSocket handshakes — the
    // subprotocol is the standard way to pass tokens/versions, and it travels
    // as the Sec-WebSocket-Protocol header so the proxy can record it
    const ws = new WebSocket(WS_URL, ['chat-v1']);
    wsRef.current = ws;

    ws.onopen = () => setStatus('open');
    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('closed');
    ws.onmessage = (event) => {
      let entry: string;
      try {
        entry = formatServerMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        entry = String(event.data);
      }
      setLog((prev) => [...prev, { direction: 'received', text: entry }]);
    };

    return () => ws.close();
  }, []);

  function send(payload: object, logText: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
    setLog((prev) => [...prev, { direction: 'sent', text: logText }]);
  }

  function sendChat() {
    if (!text.trim()) return;
    send({ type: 'chat', text, sentAt: new Date().toISOString() }, text);
    setText('');
  }

  function sendBurst() {
    send({ type: 'burst', count: 20 }, 'burst x20');
  }

  return (
    <div className="container">
      <h1>WebSocket Chat</h1>

      <div className="card">
        <p>
          Status:{' '}
          <span className={`ws-status ws-status-${status}`} data-testid="ws-status">
            {status}
          </span>
        </p>
      </div>

      <div className="card">
        <div className="form-row">
          <input
            type="text"
            placeholder="Send a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            data-testid="ws-input"
          />
          <button className="btn-primary" onClick={sendChat} data-testid="ws-send-btn">
            Send
          </button>
          <button className="btn-ghost" onClick={sendBurst} data-testid="ws-burst-btn">
            Burst x20
          </button>
        </div>
      </div>

      <div className="card">
        {log.length === 0 ? (
          <p className="empty">No messages yet.</p>
        ) : (
          log.map((entry, i) => (
            <div
              key={i}
              className={`ws-message ws-message-${entry.direction}`}
              data-testid={entry.direction === 'received' ? 'ws-message' : 'ws-sent-message'}
            >
              {entry.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
