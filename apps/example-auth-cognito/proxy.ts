import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

// Cognito (USER_PASSWORD_AUTH via the browser) needs no Next.js middleware of its
// own, so this stays the simple case: just the recorder. Providers that DO own
// middleware (Clerk, Auth0, WorkOS) compose theirs with `setNextProxyHeaders` here.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
