# TanStack Start — authenticated apps & cache-header ISR

Detail for the two patterns summarized in SKILL.md. Both compose with
`registerProxyFetch()` from the main skill.

## Authenticated apps (real auth provider)

An authenticated app has two kinds of traffic that need opposite treatment:

| Traffic | Proxy mode | Why |
| ------- | ---------- | --- |
| **Login** (credentials → token) | `transparent` | Must never land in a committed recording. |
| **Protected app data** (authenticated requests) | `record` / `replay` | This is what we want to test offline. |

The flow (mirrors `apps/example-tanstack-start`):

1. A Playwright **`setup` project** logs in **once** with the proxy in
   `transparent` mode and saves `storageState` (the token) to a gitignored
   `e2e/auth-state.json`. The login is passed straight through and never recorded.
   The provider call (e.g. Cognito `InitiateAuth`) also goes to a different host
   than the proxy, so it can't be recorded either way.
2. The **authenticated specs** depend on `setup`, load that `storageState`, and
   start already authenticated. Their app-data requests run in `record` / `replay`.
3. Each recorded request carries `Authorization: Bearer …`; the recorder redacts
   it, so no token reaches the repo.

### Where the token lives decides the mechanism

- **`localStorage` token → client fetch (HAR).** The server can't read
  `localStorage`, so **do not SSR-prefetch** the protected resource. Read the
  token after mount and fetch on the client; `playwrightProxy.before(page,
  testInfo, mode, { url: /localhost:8100/ })` records it via HAR — exactly like a
  non-authenticated browser fetch.

  ```typescript
  // src/routes/dashboard.tsx
  function DashboardPage() {
    const navigate = useNavigate();
    const [token, setTok] = useState<string | null>(null);
    useEffect(() => {
      const t = getToken();          // localStorage — client only
      if (!t) return void navigate({ to: '/login' });
      setTok(t);
    }, [navigate]);
    if (!token) return <p data-testid="dashboard-status">loading</p>;
    return <ProtectedTodoApp token={token} />; // useQuery + useMutation, Bearer header
  }
  ```

- **Cookie session → loader fetch (`.mock.json`).** A cookie rides the SSR request
  automatically, so a loader *can* fetch the protected resource server-side.
  Forward the recording id with `createHeadersWithRecordingId()`:

  ```typescript
  loader: async () => {
    const res = await fetch('http://localhost:8100/protected/todos', {
      headers: await createHeadersWithRecordingId(),
    });
    return res.json();
  }
  ```

### setup-auth.ts (transparent login → storageState)

```typescript
// e2e/setup-auth.ts
import { test as setupAuth } from '@playwright/test';
import { setProxyMode } from 'test-proxy-recorder';
import { authStatePath } from './auth-state-path';

setupAuth('authenticate', async ({ page }) => {
  await setProxyMode('transparent');            // login is passed through, never recorded
  await page.goto('/login');
  await page.getByTestId('email').fill(process.env.COGNITO_TEST_EMAIL!);
  await page.getByTestId('password').fill(process.env.COGNITO_TEST_PASSWORD!);
  await page.getByTestId('signinButton').click();
  await page.waitForURL('**/dashboard');
  await page.waitForFunction(() => !!window.localStorage.getItem('auth-token'));
  await page.context().storageState({ path: authStatePath }); // token snapshot for the specs
});
```

### playwright.config.ts — gate the auth suite on credentials

Real login needs a test user. Gate the `setup` + `auth` projects on the creds
being present so a credential-less clone (and forks without secrets) still replays
every other spec offline. Load `.env.local` (gitignored) for the creds.

```typescript
try { process.loadEnvFile('.env'); } catch {}
try { process.loadEnvFile('.env.local'); } catch {}  // secrets; CI env still wins
const hasCognito = !!(process.env.COGNITO_TEST_EMAIL && process.env.COGNITO_TEST_PASSWORD);

export default defineConfig({
  projects: [
    // Base project never runs the auth files.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] },
      testIgnore: [/setup-auth\.ts/, /auth\.spec\.ts/] },
    // Auth suite only when creds exist.
    ...(hasCognito ? [
      { name: 'setup', testMatch: /setup-auth\.ts/ },
      { name: 'auth', testMatch: /auth\.spec\.ts/,
        use: { ...devices['Desktop Chrome'], storageState: authStatePath },
        dependencies: ['setup'] },
    ] : []),
  ],
});
```

### Redaction guard

The token is dynamic (a fresh JWT per login), so assert that **no** JWT survives
in any recording, and that the login produced no recording:

```javascript
// e2e/assert-redactions.mjs (excerpt)
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/;
for (const file of files) {
  if (JWT_RE.test(await readFile(join(DIR, file), 'utf8'))) fail(`${file} leaks a JWT`);
}
for (const prefix of ['setup-auth', 'authenticate']) {
  if (files.find((f) => f.startsWith(prefix))) fail('login must run in transparent mode, never recorded');
}
```

### Do not commit the provider's pool config

Even the "public" `VITE_COGNITO_REGION` / `VITE_COGNITO_CLIENT_ID` (baked into the
client bundle) tie the repo to a real account. Keep them — and the secret
`COGNITO_TEST_*` — in a gitignored `.env.local` (or CI secrets). Vite still bakes
`VITE_*` in at build time from `.env.local`. Verify with
`git grep <client-id>` before committing.

## Cache-header ISR

TanStack Start ISR is HTTP-cache-header based: a CDN caches the HTML and
revalidates in the background. The recorder coexists with it — the SSR prefetch's
`fetch` is still tagged by `registerProxyFetch()`, so record captures it and
parallel replay serves it from the right session.

```typescript
// src/routes/isr.tsx
export const Route = createFileRoute('/isr')({
  loader: ({ context }) => context.queryClient.ensureQueryData(isrTodosQueryOptions),
  headers: () => ({
    'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=86400',
  }),
  component: IsrPage,
});
```

Use a query key distinct from the live home page so the cached route's render is
independent. On-demand invalidation (a CDN purge in production) is triggered by a
token-authenticated server route (`src/routes/api/revalidate.ts`); gate it behind a
secret supplied via Playwright `extraHTTPHeaders`, exactly as in the Next.js ISR
pattern.

Source: apps/example-tanstack-start/src/routes/isr.tsx, src/routes/api/revalidate.ts, e2e/isr.spec.ts
