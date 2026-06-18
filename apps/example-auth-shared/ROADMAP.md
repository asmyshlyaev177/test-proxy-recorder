# Auth provider examples — roadmap

How `test-proxy-recorder` works with **authenticated** apps, and the plan for
covering multiple auth providers without duplicating an app per provider.

## The pattern (provider-agnostic)

An authenticated app has two kinds of traffic, and they need opposite treatment:



| Traffic | Mode | Why |
| ------- | ---- | --- |
| **Login** (credentials → token) | `transparent` | Must never land in a committed recording. |
| **App data** (authenticated requests) | `record` / `replay` | This is what we want to test offline. |

The flow, mirrored from the real-world `channels/web` app:

1. A Playwright **`setup` project** logs in **once** with the proxy in
   `transparent` mode and saves `storageState` (token + cookie) to a gitignored
   `e2e/auth-state.json`. The login flow is passed straight through and never recorded.
2. The real specs depend on `setup`, load that `storageState`, and start
   already authenticated. Their app-data requests run in `record`/`replay`.
3. Each recorded request still carries an `Authorization: Bearer …` header and a
   session cookie — the recorder **redacts** both, so no token reaches the repo.

This is verified end-to-end by `example-auth-mock`'s `assert-redactions.mjs`:
the login produces **no** recording, and the dashboard recording shows `[REDACTED]`.

## Why many thin apps, not one mega-app

A single app can't host every provider: most own the Next.js middleware slot
(`clerkMiddleware`, Auth0's `middleware`, WorkOS `authkitMiddleware`) — the same
slot the recorder's `proxy` uses — plus conflicting root-layout providers, env
keys, and SDKs. And an example must be **copy-pasteable**: a Clerk user wants
*the Clerk app*, not a mega-app to disentangle.

So: **one thin app per provider, sharing everything provider-agnostic.**

## Structure

```text
apps/
  example-auth-shared/      ← app-runtime core only (no app, no build step)
    src/components/TodoApp   protected-resource UI (Bearer header support)
    src/styles/globals.css
    mock-backend/            the application backend: /protected/todos (+ mock /login)
  example-auth-mock/        ← first consumer / template; owns ALL of its e2e
    proxy.ts                 provider middleware ∘ recorder (mock: just the recorder)
    e2e/setup-auth.ts        login → transparent mode → save storageState
    e2e/dashboard.spec.ts    the authenticated specs
    e2e/assert-redactions.mjs redaction guard
    playwright.config.ts     plain, self-contained
  example-auth-cognito/     ← real AWS Cognito login (browser InitiateAuth)
  example-auth-clerk/  …    ← next
```

**The per-provider seam is exactly two files in each app:**

1. `proxy.ts` — compose the provider's middleware with `setNextProxyHeaders`.
2. `e2e/setup-auth.ts` — how this provider obtains a session.

Only the app-runtime pieces (UI, backend, styles) come from `example-auth-shared`;
each app owns all of its own e2e code. The shared `/protected/todos` endpoint
accepts **any** non-empty Bearer token or `session` cookie — it doesn't verify
*who* issued the identity, which is what lets every provider record against it.

## CI/CD

Each provider example runs the same `test:e2e:ci` as `example-auth-mock`
(record → assert redaction → replay) in a single job: recordings stay gitignored
and are re-recorded every run. The only addition for a real provider:
`e2e/setup-auth.ts` logs in with credentials read from env, supplied in CI as
**secrets**. The protected app-data still goes to the shared mock backend and is
recorded/redacted exactly as in the mock — the provider only handles login.

- Secrets live in this repo's Actions config, so pushes and same-repo PRs run the
  full record + replay.
- **Forks don't receive secrets** (by GitHub design). That's fine: a forker who
  wants these examples green in their own CI sets their own provider credentials —
  their responsibility, not something we design around.
- Self-hosted providers (Better Auth, Supabase local, Firebase emulator) need no
  secrets and run anywhere, forks included.

## Providers to implement (most popular first)

`CI login` = how a session is obtained in CI. Pricing is a non-issue — every
provider's free tier (10k–1M MAUs, or self-hosted) is orders of magnitude beyond
a couple of test users (an MAU counts per *user*, not per login). The deciding
axis is whether CI needs secrets, not cost.

| Provider | Status | CI login | CI secrets |
| -------- | ------ | -------- | ---------- |
| **mock** | ✅ done | Form login, `transparent` mode. | none |
| **cognito** | ✅ done (`example-auth-cognito`) | Browser `InitiateAuth` (`USER_PASSWORD_AUTH`), public app client. | yes |
| **next-auth / Auth.js** | ▢ planned | Credentials provider, programmatic sign-in. | often none |
| **clerk** | ▢ planned | `@clerk/testing` token + Frontend API sign-in. | yes |
| **supabase** | ▢ planned | `signInWithPassword`. | local stack: none / hosted: yes |
| **auth0** | ▢ planned | Resource Owner Password grant. | yes |
| **firebase** | ▢ planned | Identity Toolkit REST / Auth emulator. | emulator: none / real: yes |
| **workos** | ▢ planned | API session / password auth. | yes |
| **better-auth** | ▢ planned | Local `signIn` API — fully self-hosted. | none |

## Adding a new provider

1. `cp -r apps/example-auth-mock apps/example-auth-<provider>` and bump ports.
2. Replace `proxy.ts` with the provider-middleware ∘ recorder composition.
3. Replace `e2e/setup-auth.ts` with the provider's login (UI in dev / programmatic
   token grant in CI, like `channels/web`), reading credentials from env.
4. Wire provider env/secrets; keep `auth-state.json` and `e2e/recordings/`
   gitignored (re-recorded each run, same as the mock).
5. Point the dashboard's `TodoApp` at `/protected/todos` with the provider's
   token — the shared backend and redaction guard need no changes.
6. CI: add a `<provider>:test:e2e:ci` step to the `e2e` job and register its
   secrets.

## Open follow-up

`example-nextjs16` still has its own copy of `TodoApp` + a todos backend. It can
be migrated onto `example-auth-shared` later; deferred to avoid destabilizing its
passing record/replay/redaction tests.
