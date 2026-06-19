# test-proxy-recorder — AI setup prompt (draft v1)

> Paste this into your AI coding agent (Claude Code, Cursor, etc.) from the root
> of the project you want to add e2e recording to. The agent does the whole
> setup: installs skills, runs `init`, completes the one app-specific step
> `init` can't do, and verifies record + replay actually work.

---

Set up **test-proxy-recorder** in this project so our Playwright e2e tests record
real API responses once and replay them on CI with the backend turned off. Work
through the steps below in order. **Stop and ask me** whenever a choice is
genuinely project-specific and you can't infer it from the code (see "Ask me
about" at the end) — don't guess at the backend URL or invent env vars.

## 0. Load the skills

First run `npx @tanstack/intent@latest install` to install the test-proxy-recorder
agent skills, then read them before writing any code:
- `test-proxy-recorder/proxy-setup` (core: CLI, scripts, fixtures, record/replay)
- `test-proxy-recorder/nextjs-ssr` (only if this is a Next.js app)

Everything below must match the patterns in those skills. If a skill and this
prompt ever disagree, the skill wins — tell me about the conflict.

## 1. Understand the project first

Before changing anything, figure out and tell me:
- **App type**: full-stack with SSR (Next.js etc.) vs. browser-only SPA/extension.
- **Package manager** (npm/pnpm/yarn/bun) and, for Next.js, the **major version**
  (13–15 use `middleware.ts`; 16+ uses `proxy.ts`).
- **How the app reads its API base URL today** — which env var(s), and whether
  there are separate server-side and browser-side base URLs (e.g.
  `INTERNAL_API_URL` for SSR, `NEXT_PUBLIC_API_URL` for the browser).
- **HTTP client** for server-side calls: native `fetch` vs. `axios`/other.
- The **real backend URL** the app talks to in development.

## 2. Run init

Run the scaffolder, pointing `<target>` at the **real dev backend URL** from step 1:

```
npx test-proxy-recorder init <target> --port 8100 --dir ./e2e/recordings
```

This is non-destructive. It writes `test-proxy-recorder.config.ts`, an `e2e/`
fixture + global teardown, a Playwright config (or edits an existing one),
package.json scripts, and — on Next.js — the middleware (`proxy.ts`/`middleware.ts`).
Report what it created vs. skipped.

## 3. The one thing init can't do: point the app at the proxy

`init` cannot know which env var holds your API base URL. Wire it so that **in
dev/test the app talks to the proxy (`http://localhost:8100`), and in production
it talks to the real backend** — the proxy never runs in production.

Apply this to **every** place the app builds an API base URL, both server-side
and browser-side. Use the env var the app already uses; default it to the proxy:

```ts
// dev/test → proxy (recorded); production → real backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100';
```

Use the proxy host:port you actually gave `init` — `8100` here is just the
default; check `test-proxy-recorder.config.ts` and use that port. If the app has
no API-base env var yet, introduce one (and set the real URL in production
config). Do **not** hardcode the proxy URL with no production escape hatch.

## 4. Tag server-side fetches with the session header (Next.js only)

Server-side fetches need the `x-test-rcrd-id` header so the proxy can group them
under the right test. Playwright already sets it on the browser navigation, so
the id is in `headers()`; you just need to attach it to outgoing SSR requests.
Pick **one** (see the `nextjs-ssr` skill):

- **Default — `fetch` apps** → add `registerProxyFetch()` at the top of the root
  layout (`app/layout.tsx`). One line, tags every server-side fetch, works on Node
  **and** Edge runtimes.
- **axios apps** → call `registerProxyAxios(instance)` on each server-side axios
  instance.
- **Per-call / dev-mode-safe** → `createHeadersWithRecordingId(await headers(), {...})`
  on individual fetches. No global patch (immune to the dev-server caveat below).

A `proxy.ts`/`middleware.ts` with `setNextProxyHeaders` is **optional** — it only
exposes the id, it does not tag fetches; don't rely on it alone. All helpers are
no-ops in production unless `TEST_PROXY_RECORDER_ENABLED=true`.

**Record against a production build** (`next build && next start`), not `next dev`
— the dev server can reset the `registerProxyFetch` global-fetch patch between
requests ([vercel/next.js#47596](https://github.com/vercel/next.js/issues/47596)).

## 5. Set CLIENT_SIDE_URL in the fixture

In `e2e/fixtures.ts`, set `CLIENT_SIDE_URL` to the **external** domains the
browser calls directly (auth provider, CDN, third-party APIs) — **not** the proxy
URL. Server-side fetches through the proxy are recorded automatically. If the
browser only ever talks to your own API through the proxy, you can omit `url`.

## 6. Auth setup project (only if the app requires login)

If the app gates pages behind login, add a Playwright **`setup` project** that
logs in once against the **real** auth provider and saves `storageState`, so the
smoke test and the real specs start authenticated. Auth must never be recorded or
replayed — put the proxy in `transparent` mode for the login (see the
`proxy-setup` skill's "Auth setup"):

```ts
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';

const AUTH_FILE = 'e2e/.auth/state.json';

setup('authenticate', async ({ page }) => {
  await setProxyMode('transparent');        // login hits the REAL provider
  await page.goto('/login');                // adapt selectors/URL to the app
  await page.getByTestId('email').fill(process.env.E2E_EMAIL!);
  await page.getByTestId('password').fill(process.env.E2E_PASSWORD!);
  await page.getByTestId('signinButton').click();
  await page.waitForURL('/');               // snapshot as soon as the session token exists;
  await page.context().storageState({ path: AUTH_FILE }); // don't await protected data (hangs in replay)
});
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  { name: 'chromium', dependencies: ['setup'],
    use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' } },
],
```

Gitignore the state file (`e2e/.auth/`). Read the test credentials from env vars
(`process.env.E2E_EMAIL` etc.) — the preferred way; ask me for them rather than
guessing. Inlining literal credentials is tolerable only if they belong to a
dedicated **test/staging** account — **never production credentials**, since
recording performs a real login. Include the auth provider's domain in
`CLIENT_SIDE_URL` if the browser calls it directly. Skip this whole step for apps
with no login.

## 7. Write a smoke test

So setup is verifiable end-to-end, add one minimal spec that exercises a real
recorded request — open the app's main page and assert a real element/field is
visible. Use the `init` fixture (and the `setup` dependency if you added one):

```ts
// e2e/smoke.spec.ts
import { test, expect } from './fixtures';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

Pick a selector that reflects data fetched from the API (so the recording is
actually exercised) — inspect the app to choose a stable `getByTestId` / role /
text. If e2e specs already exist, reuse one as the smoke test instead of adding a
near-duplicate.

## 8. Wire the scripts

Ensure package.json can run the app and proxy together for both recording and
replay. For Next.js, record/replay against a **production build** (`build` +
`start`), not `next dev`, and set `TEST_PROXY_RECORDER_ENABLED=true` on the app
process. Use `concurrently` + `wait-on` so tests start only once the app and the
proxy's `/__control` endpoint are up. (See the skill's full-stack script block.)

## 9. Verify it works — all three modes, separately

Don't declare done until you've confirmed each, using the smoke test from step 7:

1. **Production sanity (no-op)**: with `NODE_ENV=production` and
   `TEST_PROXY_RECORDER_ENABLED` unset, confirm the app points at the real
   backend and none of the recorder helpers do anything.
2. **Record**: set `MODE = 'record'`, run the record script once against the real
   backend (single worker), and confirm `.mock.json` / `.har` files appear under
   `e2e/recordings/` for the server-side and browser-side traffic respectively,
   and the smoke test passes.
3. **Replay**: set `MODE = 'replay'`, **stop the backend**, run the test script,
   and confirm the smoke test passes purely from the committed recordings.

Report the result of each. If replay fails, the usual causes are: the app env
var not pointed at the proxy, `CLIENT_SIDE_URL` matching the proxy instead of
external domains, or (Next.js) the SSR header not forwarded — check those first.

## Ask me about

- The real backend URL, if you can't find it in the code/config.
- Which env var the app reads its API base URL from, if there's more than one
  candidate or none.
- The auth provider, if login is involved (auth must run against the real
  provider in `transparent` mode, never recorded).
- Anything where guessing would write the wrong URL, env var, or file.
