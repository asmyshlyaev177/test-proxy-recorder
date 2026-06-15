# example-websocket — record/replay a real third-party WebSocket feed

A live **BTC-USD price ticker** backed by Binance's public WebSocket feed
(`wss://stream.binance.com:9443/ws/btcusdt@ticker`). It records the real feed
**once** through the proxy, then replays the captured messages from disk on CI —
no network, no exchange account, deterministic prices every run.

This is the WebSocket counterpart to the HTTP examples: the same proxy that
records `.mock.json` for HTTP requests also records WebSocket traffic into
`.mock.json`. The browser connects to the proxy (`ws://localhost:8100/...`)
instead of Binance; in **record** mode the proxy forwards the handshake to
Binance and captures every message, in **replay** mode it serves the captured
messages back with no upstream connection.

```text
  Record mode                                  Replay mode

  Browser ──ws──> Proxy ──wss──> Binance        Browser ──ws──> Proxy ──> Disk
                    │                                             │
                    └──> e2e/recordings/*.mock.json               └──> serves saved messages
```

## Why a crypto feed

It's the use case no other record/replay tool covers well: a **server-push**
stream from a third party you don't control and can't run on CI. Record it once
and your tests get a fixed, fast, offline price stream forever. Binance's
`@ticker` stream pushes ~once per second, so each price update stays on screen
long enough to assert against.

## How it's wired

- **App** ([src/main.ts](src/main.ts)) — opens a WebSocket to
  `import.meta.env.VITE_WS_URL ?? 'wss://stream.binance.com:9443/ws/btcusdt@ticker'`
  and renders the last price (`c`) from each pushed message. Binance's raw
  stream needs no subscribe message. In production it talks straight to Binance;
  under test the build bakes `VITE_WS_URL=ws://localhost:8100/ws/btcusdt@ticker`
  so it talks to the proxy.
- **Proxy** — `test-proxy-recorder https://stream.binance.com:9443 --port 8100 --dir ./e2e/recordings`
  (the `proxy` script). `https://` is rewritten to `wss://` when forwarding.
- **Tests** ([e2e/ticker.spec.ts](e2e/ticker.spec.ts)) — `playwrightProxy.before()`
  with no `url` option, because the only traffic is the WebSocket (recorded
  server-side). Each test reads the expected price sequence out of its own
  committed `.mock.json` (no hardcoded numbers), and the two differ by replay
  pacing:
  - **burst** (the default) serves all messages at once, so it asserts the
    ticker shows the **final** recorded price.
  - **original** (`before(..., { websocket: { timing: 'original' } })`) re-paces
    messages from their recorded timestamps. Because Binance ticks ~once per
    second, each update is on screen long enough that a plain `toHaveText`
    catches it — so this test asserts **every** update in a cycle, one per tick.

The committed recordings in [e2e/recordings/](e2e/recordings) are real Binance
ticker streams.

## Run it

```bash
# Replay (offline, deterministic) — the default. Recordings are already committed.
pnpm test:e2e

# Re-record against the live Binance feed (needs network), then commit.
pnpm test:e2e:record
git add e2e/recordings/
```

> `test:e2e` and `test:e2e:record` build the app with `VITE_WS_URL` pointed at
> the proxy first, then run Playwright. The proxy and the `vite preview` server
> are started automatically by `playwright.config.ts`.

## Notes on replay fidelity

- By default replay serves the recorded server messages as a burst on connect —
  fastest and best for CI. With a burst, intermediate updates are overwritten
  faster than any assertion can observe, so assert the **final** state.
- For original timing, the per-update assertion only works because Binance's
  feed is paced ~1s apart. A real-time feed (e.g. Coinbase's `ticker` channel)
  bursts several trades within the same millisecond — those updates can't be
  observed individually on a single element by any polling tool. Pick a paced
  feed, or assert the final state.
- Per-test pacing is set with
  `playwrightProxy.before(page, testInfo, mode, { websocket: { timing: 'original' } })`;
  set it for the whole proxy instead with `--ws-timing original` /
  `websocket: { timing: 'original' }` in the config. An original-timing test
  takes about as long as the recording's wall-clock span.
- To record a different pair, change the stream path in
  [src/main.ts](src/main.ts) / the `build:test` script and re-record.
