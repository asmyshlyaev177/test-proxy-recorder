---
title: Secret redaction
description: Redaction is on by default — Authorization, Cookie, and Set-Cookie are stripped from recordings before they hit disk. Add header and body patterns, allow-list cookies, or redact programmatically.
---

Recordings get committed to git, so secrets are stripped before anything is written to disk. Redaction is **on by default**; the proxy replaces the values of these request/response headers with `[REDACTED]`:

- `Authorization`
- `Cookie`
- `Set-Cookie`

This is safe: replay matching ignores these headers, so redaction never breaks playback. It applies to `.mock.json` recordings, WebSocket recordings, and `.har` files. To turn redaction off, pass `--no-redact` on the CLI or set `redaction: false` in the [config](/docs/guides/config/).

When only *some* cookies are sensitive, allow-list the harmless ones by name (for example a `theme` or A/B-test cookie). Allow-listed cookies keep their values inside `Cookie`/`Set-Cookie`; every other cookie is still redacted.

:::note[How `.har` files are redacted]
`.har` files are written by Playwright's `routeFromHAR`, not the proxy, so they're redacted in a separate pass. `playwrightProxy.teardown()` rewrites every `.har` in the recordings dir using the **same redaction config** as the proxy (headers, `allowCookies`, and `bodyPatterns` all apply, to both the headers and the parsed `cookies` arrays). This runs from your Playwright **`globalTeardown`** — so HAR redaction requires a `globalTeardown` that calls `playwrightProxy.teardown()` (the [recommended setup](/docs/integrations/playwright/#global-teardown-recommended), scaffolded by `init`).

It can't run per-test: Playwright flushes a HAR when its context closes but doesn't await close handlers, so redacting there races the process exit and can truncate the file. The teardown fetches the config from `/__control` (the proxy must be running; if unreachable the built-in header defaults still apply), only rewrites files it actually changed, and leaves base64 response bodies untouched. For defense in depth, still record with short-lived test credentials and review HARs before committing — see the recommended auth pattern below.
:::

## Recommended auth pattern

To keep the login flow and credentials out of recordings entirely, run authentication in a Playwright **setup project** with the proxy in `transparent` mode, persist `storageState` to a **gitignored** `auth-state.json`, and reuse it in your tests. Recorded requests then carry only the (redacted) session headers, never the login.

See the [authenticated app example](/docs/reference/examples/#authenticated-app) for a working setup against a real auth provider.

## Tweaking what gets redacted

The default headers always apply (while redaction is on); you can add to them.

### CLI flags

- `--no-redact` — disable secret redaction (on by default).
- `--redact` — enable secret redaction; only needed to re-enable when the config sets `redaction: false`.
- `--redact-headers <names>` — comma-separated extra header names to redact (merged with the defaults).
- `--redact-body <patterns>` — comma-separated regex patterns to redact from request/response bodies.
- `--allow-headers <names>` — comma-separated header names to exempt from redaction (for example `set-cookie`).
- `--allow-cookies <names>` — comma-separated cookie names to keep unredacted inside `Cookie`/`Set-Cookie`.

```bash
# Redaction is already on; also redact an API-key header and "sk_live_..." tokens, keep the theme cookie
test-proxy-recorder http://localhost:8000 \
  --redact-headers x-api-key \
  --redact-body "sk_live_[a-zA-Z0-9]+" \
  --allow-cookies theme,locale
```

### Programmatic

When constructing `ProxyServer` directly:

```typescript
import { ProxyServer } from 'test-proxy-recorder';

// Passing this object enables redaction; pass `false` (or nothing) to keep it off.
const proxy = new ProxyServer('http://localhost:3000', './recordings', undefined, {
  headers: ['x-api-key', 'x-auth'],    // extra headers, merged with the defaults
  bodyPatterns: [/sk_live_[a-z0-9]+/i], // regexes replaced in request/response bodies
  allowHeaders: ['set-cookie'],        // never redact these headers
  allowCookies: ['theme', 'locale'],   // keep these cookies inside Cookie/Set-Cookie
  placeholder: '[REDACTED]',           // default
});
```

`redactSession(session, config)` is also exported if you want to redact existing recordings yourself.
