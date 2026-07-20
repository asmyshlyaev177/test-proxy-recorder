// ─────────────────────────────────────────────────────────────────────────────
// THE INTERESTING PART: signing in to a real auth provider (AWS Cognito) from a
// TanStack Start app.
//
// In your app this is wherever you'd call your provider's SDK. Everything below
// the divider is just token plumbing — read it only if you care.
// ─────────────────────────────────────────────────────────────────────────────

// Public Cognito config — baked into the client bundle at build time (VITE_*),
// and NOT secret (a pool/client id is shipped to browsers normally). Reused from
// the example-auth-cognito example: the same test user pool.
const REGION = import.meta.env.VITE_COGNITO_REGION;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

/**
 * Authenticate against real Cognito and return the access token (a JWT).
 *
 * We call Cognito's `InitiateAuth` (USER_PASSWORD_AUTH flow) directly with
 * `fetch` — the same JSON API the AWS SDKs use under the hood — to keep the
 * example dependency-free. Requires a PUBLIC app client (no secret) with
 * ALLOW_USER_PASSWORD_AUTH enabled (see README).
 *
 * This always hits real Cognito. During the e2e `setup` the proxy is in
 * TRANSPARENT mode (and Cognito is a different host than the proxy), so the login
 * is never recorded — only the app's own protected API calls are.
 */
export async function cognitoSignIn(
  email: string,
  password: string,
): Promise<string> {
  if (!REGION || !CLIENT_ID) {
    throw new Error(
      'Cognito is not configured — set VITE_COGNITO_REGION and VITE_COGNITO_CLIENT_ID (see README).',
    );
  }

  const res = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Cognito login failed (${res.status})`);
  }

  const token = data.AuthenticationResult?.AccessToken as string | undefined;
  if (!token) {
    // e.g. NEW_PASSWORD_REQUIRED — the test user still has a temporary password.
    throw new Error(
      `Unexpected Cognito response${data.ChallengeName ? `: ${data.ChallengeName}` : ''}`,
    );
  }
  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plumbing: storing the access token in localStorage. Nothing recorder-specific.
// The token lives on the client, so the protected dashboard fetches on the client
// (recorded via HAR) rather than SSR-prefetching — see src/routes/dashboard.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'auth-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
