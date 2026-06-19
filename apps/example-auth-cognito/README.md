# Example: authenticated app (AWS Cognito)

An app that logs into a **real AWS Cognito** user pool, then loads protected data.
The one idea to take away:

```text
  Login          ──> real Cognito        (live every run; never recorded)
  Protected data ──> proxy RECORD/REPLAY ──> your API     (recorded once, replayed forever)
```

Your auth provider stays live; your API gets recorded once and replayed with **no
backend** on CI. The token the protected requests carry is redacted from the
recordings.

## The 4 files that matter

Everything else (the todo UI, the stand-in backend) is just a demo app. The
test-proxy-recorder + Cognito integration is only these:

| File | What it does |
| ---- | ------------ |
| [app/lib/auth.ts](app/lib/auth.ts) | `cognitoSignIn()` — the real provider call. Swap for your provider. |
| [e2e/setup-auth.ts](e2e/setup-auth.ts) | Logs in once in `transparent` mode (never recorded), saves `storageState`. |
| [e2e/dashboard.spec.ts](e2e/dashboard.spec.ts) | `playwrightProxy.before(...)` — one line that records/replays the protected calls. |
| [test-proxy-recorder.config.ts](test-proxy-recorder.config.ts) + the `record`/`test:e2e` scripts | Point the proxy at your API; record vs. replay. |

(No Next.js middleware needed here: the protected data is fetched **client-side**,
so the browser request is recorded directly. Apps that fetch protected data
**server-side** add `registerProxyFetch()` to the root layout — or
`registerProxyAxios(instance)` for axios — to tag SSR requests; see the
`nextjs-ssr` skill.)

## Map this example to your app

| In this example | In your app |
| --------------- | ----------- |
| `cognitoSignIn()` in `app/lib/auth.ts` | your provider's login (Cognito/Auth0/Clerk SDK) |
| the mock backend `/protected/todos` (from `example-auth-shared`) | your real API |
| `TodoApp` (from `example-auth-shared`) | your UI |
| `proxy.ts`, `e2e/`, `test-proxy-recorder.config.ts`, the `record`/`test:e2e` scripts | copy as-is |

`assert-redactions.mjs` is an extra safety net here (it fails the build if a JWT
leaks into a recording); your app doesn't need it, but it's a good idea.

| Service | Port | Role |
| ------- | ---- | ---- |
| Mock backend (`example-auth-shared`) — *stands in for your API* | 3202 | The protected API. |
| Proxy (`test-proxy-recorder`) | 8100 | Records/replays. |
| Next.js | 3200 | The app under test. |

See [the roadmap](../example-auth-shared/ROADMAP.md) for the multi-provider plan,
and [example-auth-mock](../example-auth-mock) for the same pattern with no cloud account.

## AWS setup (one-time)

You need a Cognito **user pool**, a **public app client** with the
`USER_PASSWORD_AUTH` flow, and one **confirmed test user with a permanent
password**. Free tier (10,000 MAUs/mo) covers this comfortably.

### Prerequisites

- An **AWS account** (the free tier is enough).
- **AWS CLI v2** installed (`aws --version` → `aws-cli/2.x`). Install:
  [AWS docs](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
- Credentials configured: `aws configure` (an access key from an IAM user/SSO with
  permission to manage Cognito). Verify with `aws sts get-caller-identity`.
- The IAM principal needs these actions (the AWS managed policy
  `AmazonCognitoPowerUser` covers them, or scope a custom policy):
  `cognito-idp:CreateUserPool`, `CreateUserPoolClient`, `AdminCreateUser`,
  `AdminSetUserPassword`, `DescribeUserPool`, `InitiateAuth`, and
  `DeleteUserPool` (for cleanup).
- Pick a region and export it so every command below reuses it:

  ```bash
  export REGION=us-east-1
  ```

### Step 1 — create the user pool

We don't set `--username-attributes`, so the username is a plain string (we'll use
the email text as the username). The default password policy requires ≥8 chars
with upper/lower/number/symbol — the sample password below satisfies it.

```bash
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name tpr-example \
  --region "$REGION" \
  --query 'UserPool.Id' --output text)
echo "POOL_ID=$POOL_ID"   # e.g. us-east-1_AbCdEf123
```

### Step 2 — create a PUBLIC app client

It must have **no client secret** (a browser can't safely hold one / compute the
`SECRET_HASH`) and must explicitly enable the `USER_PASSWORD_AUTH` flow.

```bash
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" \
  --client-name tpr-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region "$REGION" \
  --query 'UserPoolClient.ClientId' --output text)
echo "CLIENT_ID=$CLIENT_ID"
```

> Already created a client without the flow? Update it (this **replaces** the flow
> list, so pass all the flows you want):
>
> ```bash
> aws cognito-idp update-user-pool-client \
>   --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" --region "$REGION" \
>   --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
> ```

### Step 3 — create the test user with a permanent password

`admin-create-user` alone leaves the user in `FORCE_CHANGE_PASSWORD`, which makes
`InitiateAuth` return a `NEW_PASSWORD_REQUIRED` challenge instead of tokens.
`admin-set-user-password --permanent` fixes that. `--message-action SUPPRESS`
stops Cognito from emailing the user.

```bash
export EMAIL=test@example.com
export PASSWORD='Passw0rd!Change-me'

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --message-action SUPPRESS --region "$REGION"

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" --username "$EMAIL" \
  --password "$PASSWORD" --permanent --region "$REGION"
```

### Step 4 — verify it works (same call the app makes)

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters "USERNAME=$EMAIL,PASSWORD=$PASSWORD" \
  --region "$REGION" \
  --query 'AuthenticationResult.AccessToken' --output text
```

A long `eyJ…` JWT means you're done. If you instead see a `ChallengeName`, the
password isn't permanent (re-run step 3); an error means the flow or credentials
are wrong (see Troubleshooting).

> The app uses only **region** + **client id** at runtime; the pool id is only for
> the admin commands above.

## Configure

**Local:** `cp .env.example .env.local` and fill in the four values:

```bash
NEXT_PUBLIC_COGNITO_REGION=eu-north-1
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_TEST_EMAIL=test@example.com
COGNITO_TEST_PASSWORD=your-password
```

`playwright.config.ts` loads `.env.local`/`.env` (via `@next/env`, the same loader
Next uses), so `pnpm test:e2e` picks them up automatically — no need to `export`
in each shell. Real exported env vars still win, which is what CI relies on.

> Dotenv treats an **unquoted `#`** as a comment, so a password containing `#` (or
> other specials) must be quoted: `COGNITO_TEST_PASSWORD="p@ss#word"`. Easiest is a
> password without `#`/`*`/`$`.

**CI:** add repository **secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| ------ | ----- |
| `COGNITO_REGION` | your pool's region (e.g. `eu-north-1`) |
| `COGNITO_CLIENT_ID` | the public app client id |
| `COGNITO_TEST_EMAIL` | the test user's email |
| `COGNITO_TEST_PASSWORD` | the test user's permanent password |

The `e2e` job maps them to the build/test env and **skips** the Cognito step when
`COGNITO_CLIENT_ID` is empty (forks, or before you add them).

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `InvalidParameterException: USER_PASSWORD_AUTH flow not enabled for this client` | The app client doesn't allow the flow — run the `update-user-pool-client` command in step 2. |
| Response has `ChallengeName: NEW_PASSWORD_REQUIRED` (no tokens) | User still has a temporary password — run `admin-set-user-password --permanent` (step 3). |
| `NotAuthorizedException: Incorrect username or password` | Wrong `EMAIL`/`PASSWORD`, or the password was never made permanent. |
| `ResourceNotFoundException` | Wrong `CLIENT_ID` or `REGION` (the client is region-scoped). |
| `PasswordResetRequiredException` | Re-set a permanent password (step 3). |
| Browser console shows a CORS error on `cognito-idp.*.amazonaws.com` | Make sure the client is **public** (no secret) and you're hitting the regional endpoint; Cognito allows browser `InitiateAuth` for public clients. |
| Login hangs / network error in CI | The runner needs outbound network to AWS; the Cognito step isn't offline (only the protected-data replay is). |

## Cleanup

Deleting the pool removes its clients and users too:

```bash
aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID" --region "$REGION"
```

## Run — record once, then replay with no backend

The whole point: **record against the real backend once, then run your tests
forever without it.** That's two scripts:

```bash
pnpm --filter example-auth-cognito record    # WITH the mock backend: record + assert redaction
pnpm --filter example-auth-cognito test:e2e  # WITHOUT the mock backend: replay from recordings
```

- **`record`** starts the full stack (`mock` + proxy + app), runs the tests in
  record mode, and verifies no JWT leaked. Run it when the API changes.
- **`test:e2e`** is the everyday command — it starts only the **app + proxy**
  (`start:no-backend`, no mock backend) and serves every protected request from the
  recordings. Fast, deterministic, offline.
- **`test:e2e:ci`** = `record && test:e2e` — the full cycle CI runs.

```bash
pnpm --filter example-auth-cognito test:e2e:ci
```

`setup` always logs into Cognito (the transparent, unrecorded step), so every run
needs the env configured and network to AWS — but the **protected data** never
touches a backend on replay. You'll see one harmless `ECONNREFUSED` while `setup`
logs in: the dashboard probes the backend in transparent mode, but `setup` doesn't
depend on it.

> Why this matters for *your* tests: contributors and CI run `test:e2e` with no API
> running at all — no database to seed, no services to boot, no flakiness. The
> backend is only needed the one time you (re)record.

## Production vs the proxy

The proxy is a **dev/test-only** tool. The app's data base URL is
`NEXT_PUBLIC_API_URL`, which defaults to the proxy (`http://localhost:8100`) so
requests get recorded/replayed. For production, build with it pointed at the real
backend, and the app talks to it **directly, no proxy**:

```bash
NEXT_PUBLIC_API_URL=https://api.your-app.com pnpm --filter example-auth-cognito build
```

`NEXT_PUBLIC_*` is **inlined at build time**, so switching backends means a
rebuild — a separate build per environment. Making it runtime-configurable (one
build, env at `start`) would require dynamic/uncached rendering, and we don't
degrade the app's caching just for tests. Login is unaffected either way — it
always goes straight to Cognito.
