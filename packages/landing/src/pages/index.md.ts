import type { APIRoute } from 'astro';

import { LLMS_TXT as MARKDOWN_CONTENT } from '../lib/llms-txt';

/**
 * `/index.md` — the homepage's Markdown mirror, under the name an agent
 * guesses when it appends `.md` to a site root.
 *
 * Same bytes as /llms.txt and as the homepage's `Accept: text/markdown` branch
 * (src/middleware.ts): one document, three ways in, because agents disagree
 * about which one to try. Cacheable where the negotiated `/` is not — this URL
 * only ever has the one representation.
 *
 * On-demand for the same reason /llms.txt is (src/pages/llms.txt.ts): served
 * from the Worker, the response keeps the Content-Type set here.
 */
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(MARKDOWN_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
