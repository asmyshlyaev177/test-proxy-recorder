# Example: authenticated app (mock provider)

How to use [test-proxy-recorder](../../packages/test-proxy-recorder) with an app
that requires **login** — without recording the login flow or committing any
token. This is the always-green baseline; real providers (Cognito, Clerk, …)
follow the same shape. See [the roadmap](../example-auth-shared/ROADMAP.md).

## The idea

Two kinds of traffic, treated oppositely:

```text
  Login (POST /login)            ──> proxy in TRANSPARENT mode ──> backend     (never recorded)
  Protected data (/protected/*)  ──> proxy in RECORD/REPLAY     ──> backend     (recorded; token + cookie REDACTED)
```

1. The Playwright **`setup` project** ([e2e/setup-auth.ts](e2e/setup-auth.ts))
   logs in once in `transparent` mode and saves `storageState` (token in
   localStorage **and** an httpOnly session cookie — both mechanisms) to a
   gitignored `e2e/auth-state.json`.
2. [e2e/dashboard.spec.ts](e2e/dashboard.spec.ts) depends on it, starts already
   authenticated, and records/replays the protected todo CRUD.
3. Every recorded request carries `Authorization: Bearer …` + the cookie — the
   recorder redacts both. [e2e/assert-redactions.mjs](e2e/assert-redactions.mjs)
   proves the login was never recorded and the dashboard recording is scrubbed.

| Service | Port | Role |
| ------- | ---- | ---- |
| Mock backend (`example-auth-shared`) | 3102 | Stands in for the API + mock identity. |
| Proxy (`test-proxy-recorder`) | 8100 | Records/replays. The app points here. |
| Next.js | 3100 | The app under test. |

Demo credentials (prefilled on the login form): `test@example.com` / `Password123`.

## Run

```bash
pnpm --filter example-auth-mock test:e2e       # replay against committed-style recordings
pnpm --filter example-auth-mock test:e2e:ci    # record → assert redactions → replay
```

(Recordings and `auth-state.json` are gitignored; the CI script records fresh.)

## What's the "real provider" part?

Only two files change per provider:

- `proxy.ts` — the mock has no auth middleware, so it's just the recorder. Real
  providers compose their middleware (`clerkMiddleware`, Auth0, WorkOS) with
  `setNextProxyHeaders` here.
- `e2e/setup-auth.ts` — swap the form login for the provider's flow (UI in dev, a
  programmatic token grant in CI).
