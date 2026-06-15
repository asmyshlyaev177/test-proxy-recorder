// A live BTC-USD price ticker backed by Binance's public WebSocket feed.
//
// In production the browser connects straight to Binance. Under test we point
// VITE_WS_URL at the test-proxy-recorder proxy (ws://localhost:8100/...); the
// proxy records the real feed once, then replays it from disk on CI with no
// network. Binance's @ticker stream pushes one update per second, so each
// price change is observable.
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  'wss://stream.binance.com:9443/ws/btcusdt@ticker';

const priceEl = document.querySelector<HTMLElement>('[data-testid="price"]')!;
const statusEl = document.querySelector<HTMLElement>('[data-testid="status"]')!;

function setStatus(text: string) {
  statusEl.textContent = text;
  statusEl.dataset.state = text;
}

const ws = new WebSocket(WS_URL);

ws.addEventListener('open', () => setStatus('live'));

ws.addEventListener('message', (event) => {
  let msg: { c?: string };
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  // Binance's 24h ticker pushes the last price in `c`, once per second.
  if (typeof msg.c === 'string') {
    priceEl.textContent = `$${Number(msg.c)}`;
  }
});

ws.addEventListener('close', () => setStatus('closed'));
ws.addEventListener('error', () => setStatus('error'));
