import type { APIRoute } from 'astro';

import { LLMS_TXT as MARKDOWN_CONTENT } from '../lib/llms-txt';

// The hand-written /llms.txt (source: src/llms.txt.md). Served on-demand so the
// response keeps its `text/markdown` content type rather than the static `.txt`
// -> text/plain default a Cloudflare asset would get. Same source as the
// homepage Accept negotiation in src/middleware.ts.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(MARKDOWN_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
