// Where the mock provider stashes its access token. In a real provider example
// the SDK owns this (Amplify/Clerk/etc.); here we keep it deliberately simple.
export const TOKEN_KEY = 'auth-token';

// Dev/test: the browser talks to the proxy so requests are recorded.
// Production: point at the real backend.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100';

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
