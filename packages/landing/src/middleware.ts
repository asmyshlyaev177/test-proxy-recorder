import { defineMiddleware } from 'astro:middleware';

// Serve the Markdown reference (src/llms.txt.md, also exposed at /llms.txt) to
// AI agents that request the homepage with `Accept: text/markdown` (or
// `text/plain`) ahead of `text/html`. Everything else falls through to the
// normal HTML render. `/` is on-demand (see src/pages/index.astro) so this
// runs at request time in the Cloudflare Worker; every other route is
// prerendered and is short-circuited before any request header is read.
import { LLMS_TXT as MARKDOWN_CONTENT } from './lib/llms-txt';

export const onRequest = defineMiddleware((context, next) => {
  const { request, url } = context;

  // Only the root path negotiates. Guard first so prerendered routes never
  // touch `request.headers`, which isn't available during the build-time
  // prerender pass.
  if (url.pathname !== '/') {
    return next();
  }

  const acceptHeader = request.headers.get('accept') || '';

  const acceptsMarkdown = acceptHeader.includes('text/markdown');
  const acceptsPlainText = acceptHeader.includes('text/plain');
  const acceptsHtml = acceptHeader.includes('text/html');

  // Serve Markdown when markdown/plain is requested and either HTML isn't
  // requested at all or the markdown/plain entry comes before text/html.
  const shouldServeMarkdown =
    (acceptsMarkdown || acceptsPlainText) &&
    (!acceptsHtml ||
      acceptHeader.indexOf('text/markdown') < acceptHeader.indexOf('text/html') ||
      acceptHeader.indexOf('text/plain') < acceptHeader.indexOf('text/html'));

  if (shouldServeMarkdown) {
    return new Response(MARKDOWN_CONTENT, {
      status: 200,
      headers: {
        'Content-Type': acceptsMarkdown
          ? 'text/markdown; charset=utf-8'
          : 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        Vary: 'Accept',
      },
    });
  }

  return next();
});
