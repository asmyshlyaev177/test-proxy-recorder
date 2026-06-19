import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// On-demand ISR revalidation. In production this is typically called by a CMS
// webhook (or similar) when the underlying data changes, so the cached /isr page
// regenerates on its next request. The e2e test reuses it to force the page to
// re-run its SSR fetch at request time — flowing through the recorder proxy —
// instead of serving the build-time prerender or a stale 30s cache.
//
// Best practice: this is a privileged operation (it invalidates the cache and
// forces a regeneration on the next request), so it MUST be authenticated — an
// open endpoint would let anyone DoS the app by repeatedly nuking the cache. We
// require a shared secret (REVALIDATE_SECRET) supplied via the x-revalidate-token
// header, the same pattern Next.js recommends for CMS webhook handlers. The test
// passes the same secret; production sets its own.
function unauthorized() {
  return NextResponse.json({ revalidated: false, error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Refuse rather than operate unauthenticated — a misconfigured prod deploy
    // should fail closed, not silently expose the cache to the world.
    return unauthorized();
  }
  const token = req.headers.get('x-revalidate-token');
  if (!token || token.length !== secret.length) return unauthorized();
  // Constant-time compare to avoid timing-based token disclosure.
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  if (mismatch !== 0) return unauthorized();

  revalidateTag('isr-todos', 'max'); // drop the cached upstream todos (fetch next.tags)
  revalidatePath('/isr'); // drop the cached page HTML
  return NextResponse.json({ revalidated: true });
}
