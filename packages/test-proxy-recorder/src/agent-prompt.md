Finish setting up test-proxy-recorder in this project. `npx test-proxy-recorder init` has already scaffolded the proxy config, a Playwright fixture, a global teardown, and package.json scripts (and, on Next.js, added `registerProxyFetch()` to the root layout). Read the test-proxy-recorder agent skills first — run `npx @tanstack/intent@latest install` — then complete the app-specific steps it can't do for you:

1. Point the app's API base URL at the proxy ({{PROXY_URL}}) in dev/test ONLY — never in production (it talks to {{TARGET}} today). Use the env var the app already reads for its API base; add a production escape hatch, don't hardcode.

2. (Next.js) Make sure server-side fetches carry the recording-session id. For native `fetch`, `registerProxyFetch()` in the root layout (init added it) covers it; for axios, call `registerProxyAxios(instance)` on each server-side instance; for a one-off, `createHeadersWithRecordingId(await headers())`. Record against a production build (`next build && next start`) with `TEST_PROXY_RECORDER_ENABLED=true` — not `next dev`. The `proxy.ts`/`middleware.ts` middleware is optional. Browser-only apps can skip this.

3. In `e2e/fixtures.ts`, set `CLIENT_SIDE_URL` to the external domains the browser calls directly (auth / CDN / third-party) — not the proxy.

4. Add a minimal smoke test that opens a page and asserts a real element is visible. If the app has login, add a Playwright `setup` project that logs in against the real provider in `transparent` mode and saves `storageState` — read credentials from env vars (a dedicated test/staging account, never production).

5. Verify all three modes: production (recorder helpers are no-ops, app points at the real backend); record (`MODE='record'`, run once against the real backend with `--workers 1`, confirm `.mock.json`/`.har` files appear under {{DIR}}); replay (`MODE='replay'`, stop the backend, confirm the tests pass purely from {{DIR}}).

Stop and ask me if you can't infer the backend URL, the API-base env var, or test credentials. Never commit secrets.
