import { createFileRoute } from '@tanstack/react-router';

// On-demand ISR revalidation. TanStack Start's ISR is CDN-cache-header based
// (see the /isr route), so in production this endpoint would purge the CDN entry
// for /isr when the underlying data changes — typically called by a CMS webhook.
// The e2e test reuses it to assert the recorder coexists with the cached route.
//
// Best practice: this is a privileged operation, so it MUST be authenticated —
// an open endpoint would let anyone purge the cache at will. We require a shared
// secret (REVALIDATE_SECRET) supplied via the x-revalidate-token header. The test
// passes the same secret; production sets its own.
function unauthorized() {
  return Response.json(
    { revalidated: false, error: 'Unauthorized' },
    { status: 401 },
  );
}

export const Route = createFileRoute('/api/revalidate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.REVALIDATE_SECRET;
        if (!secret) {
          // Fail closed: a misconfigured prod deploy should refuse rather than
          // operate unauthenticated.
          return unauthorized();
        }
        const token = request.headers.get('x-revalidate-token');
        if (!token || token.length !== secret.length) return unauthorized();
        // Constant-time compare to avoid timing-based token disclosure.
        let mismatch = 0;
        for (let i = 0; i < token.length; i++) {
          mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
        }
        if (mismatch !== 0) return unauthorized();

        // In production: purge the CDN cache for /isr here. There is no local
        // cache to drop in the test runtime, so acknowledging is enough.
        return Response.json({ revalidated: true });
      },
    },
  },
});
