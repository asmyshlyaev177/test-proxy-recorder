import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setNextProxyHeaders } from 'test-proxy-recorder/nextjs';

// The mock provider has no auth middleware of its own, so this is the simplest
// possible case: just the recorder. Real-provider examples (Cognito, Clerk,
// Auth0, WorkOS) compose THEIR middleware with `setNextProxyHeaders` here — that
// composition is the per-provider part worth showing.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setNextProxyHeaders(request, response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
