import { defineMiddleware } from 'astro:middleware';

// Serve the Markdown reference (src/llms.txt.md, also exposed at /llms.txt) to
// AI agents that request the homepage with `Accept: text/markdown` (or
// `text/plain`) ahead of `text/html`. Everything else falls through to the
// normal HTML render. `/` is on-demand (see src/pages/index.astro) so this
// runs at request time in the Cloudflare Worker; every other route is
// prerendered and is short-circuited before any request header is read.
import { markdownHeaders, markdownPreference } from './lib/agent-request';
import { LLMS_TXT as MARKDOWN_CONTENT } from './lib/llms-txt';

// Advertised on the homepage response so a client that never parses <head>
// — or that only sent a HEAD request — still learns where the Markdown is.
// The prerendered routes get the same header from public/_headers.
const LLMS_TXT_LINK =
  '</llms.txt>; rel="alternate"; type="text/markdown"; title="LLM-friendly reference (llms.txt)"';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Only the root path negotiates. Guard first so prerendered routes never
  // touch `request.headers`, which isn't available during the build-time
  // prerender pass.
  if (url.pathname !== '/') {
    return next();
  }

  // Two ways in: `Accept: text/markdown`, or a user-agent belonging to a
  // coding agent or plain HTTP client. See lib/agent-request.ts for why the
  // second one is needed at all — most agents never send the header.
  const wantsMarkdown = markdownPreference(request);

  if (wantsMarkdown) {
    // `no-store`, and it has to stay that way. Shared caches key on the URL:
    // Cloudflare's edge ignores `Vary` for anything but Accept-Encoding, and
    // Vercel's ISR store ignores it outright. Served here as
    // `public, max-age=3600`, the first agent to ask `/` for Markdown after a
    // deploy can freeze this blob into the cache entry for the homepage, and
    // every human visitor after it gets a wall of plain text until the entry
    // expires — a 200 the whole time, so nothing alerts. That happened on a
    // sibling site. Keeping the variant out of shared caches means only the
    // HTML can ever be cached under `/`. `Vary` stays for intermediaries that
    // do honour it, but it is not what makes this safe. The body is a string
    // constant; caching it saves nothing worth this risk.
    return new Response(MARKDOWN_CONTENT, {
      status: 200,
      headers: markdownHeaders(wantsMarkdown),
    });
  }

  // The HTML branch. `Vary: Accept` belongs on it too — this URL now has two
  // representations, and a cache that hasn't been told so will hand the
  // Markdown to a browser (or the HTML to an agent) once one of them warms it.
  //
  // Accept only, not `Accept, User-Agent`: the user-agent branch varies this
  // URL too, but declaring it here would fragment the HTML cache per browser
  // build for no gain. What keeps the two apart is `no-store` on the Markdown
  // above; nothing about this response needs protecting, since HTML is the
  // representation everything is supposed to get by default.
  const response = await next();
  response.headers.set('Vary', 'Accept');
  response.headers.append('Link', LLMS_TXT_LINK);
  return response;
});
