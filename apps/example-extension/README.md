# Example: Chrome extension (browser-side HAR recording)

A real-world example of using [test-proxy-recorder](../../packages/test-proxy-recorder) to test a
**Chrome extension** end-to-end without hitting the live API on every run.

The extension under test ("X Profile Location") injects a content script into
`x.com` that calls X's GraphQL `AboutAccountQuery` endpoint and renders the
account's location inside the profile hover card. The test loads the real built
extension into Chrome, navigates to a profile, and asserts on what the extension
renders.

Because the extension's API calls happen **in the browser**, this example uses
the **HAR** recording mechanism: requests are recorded to a `.har` file on the
first run and replayed from disk afterwards — no network, no flakiness, no
real account needed on CI.

```text
  Record mode                              Replay mode

  Extension ──fetch──> x.com API           Extension ──fetch──> HAR on disk
       │                                         │
       └──> recorded to .har                     └──> served from .har
```

## Prerequisites

- **Node + pnpm**, with workspace deps installed (`pnpm install` at the repo root).
- **Google Chrome** installed locally. The auth step launches your real Chrome
  (`channel: 'chrome'`) so X's bot detection sees a genuine browser; see
  [Why real Chrome](#why-real-chrome-for-auth) below.
- The **built extension** in [`extension/`](extension/) (already checked in).

## Quick start — replay

```bash
pnpm test:e2e
```

Replay needs no login and no network. It serves every `x.com` request from the
recorded `.har` in [`e2e/recordings/`](e2e/recordings/).

> **Recordings are not committed to git.** A fresh clone has an empty
> `e2e/recordings/` (only `.gitkeep`), so replay has nothing to serve until you
> record once — see below. This keeps each developer's account data out of the
> repo.

## Record your own

Recording hits the **real** X API while logged in as you, and saves the traffic
to disk so future replay runs are offline and deterministic.

```bash
pnpm test:e2e:record
```

What happens:

1. **Auth** ([`e2e/auth.setup.ts`](e2e/auth.setup.ts)) runs first. It opens a
   real Chrome window. If no valid session is saved yet, **log in to X manually
   in that window** — the script continues automatically once you reach the home
   page (2 min timeout). Your session is saved to `e2e/.auth/state.json`
   (gitignored) and reused on later runs; an expired session is detected and you
   are asked to log in again.
2. The test runs against the live API in Chrome with the extension loaded. Every
   matching request is written to `e2e/recordings/<test>.har`.
3. Switch back to replay (`pnpm test:e2e`) to run offline from that recording.

`test:e2e:record` opens the Playwright UI with a single worker, which is the
most convenient way to watch the recording happen and re-run it.

## Adapting this to your own extension

- **Point at your extension** — set `EXTENSION_PATH` (env var) or drop your built
  extension in [`extension/`](extension/). See
  [`e2e/fixtures.ts`](e2e/fixtures.ts).
- **Match your API domain** — the `CLIENT_SIDE_URL` regex in
  [`e2e/fixtures.ts`](e2e/fixtures.ts) decides which browser requests are
  recorded/replayed. Change it to your own API hosts.
- **Auth** — if your target site needs a login to record, keep the
  manual-login pattern in [`e2e/auth.setup.ts`](e2e/auth.setup.ts); if it
  doesn't, you can delete the `setup` project from
  [`playwright.config.ts`](playwright.config.ts) and the auth fixture wiring.
- **Write the assertion** — model it on
  [`e2e/location.test.ts`](e2e/location.test.ts): drive the extension's UI and
  assert on what it renders, not on the raw API response.

## Files

| File | Purpose |
| ---- | ------- |
| [`playwright.config.ts`](playwright.config.ts) | Starts the proxy as a `webServer`, wires the `setup` (auth) → `e2e` project dependency. |
| [`e2e/fixtures.ts`](e2e/fixtures.ts) | Loads the extension into a persistent context and hooks `playwrightProxy.before` so browser requests are recorded/replayed. Sets `MODE` (`record` when `RECORD_MODE` is set, else `replay`). |
| [`e2e/auth.setup.ts`](e2e/auth.setup.ts) | One-time manual X login in record mode; verifies and refreshes the saved session. Skipped in replay. |
| [`e2e/stealth.ts`](e2e/stealth.ts) | Launches real Google Chrome with a coherent fingerprint for the auth step. |
| [`e2e/location.test.ts`](e2e/location.test.ts) | The actual test: hover a profile, assert the extension's rendered location. |
| `e2e/recordings/` | Recorded `.har` / `.mock.json` traffic. **Not committed** — record your own. |
| `e2e/.auth/` | Saved login session. Gitignored. |

## Why real Chrome for auth

X aggressively fingerprints the login flow. The auth step
([`e2e/stealth.ts`](e2e/stealth.ts)) launches the locally installed Google
Chrome rather than Playwright's bundled Chromium: real Chrome presents a
self-consistent fingerprint (User-Agent, `navigator.platform`, WebGL renderer
and Client Hints all agree on the real OS), so no spoofing is needed and no
single signal contradicts another. The host's real timezone is used for the same
reason — a timezone that disagrees with the connection's IP is itself a bot
signal.

The **test** context ([`e2e/fixtures.ts`](e2e/fixtures.ts)) still uses bundled
Chromium because it must load an unpacked extension via `--load-extension`, which
recent Chrome stable restricts. That split is intentional: real Chrome where it
matters for login, bundled Chromium where extension loading requires it.
