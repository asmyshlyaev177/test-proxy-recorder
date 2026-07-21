import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapURL: URL, llmsURL: URL) => `\
User-agent: *
Allow: /

# AI / LLM crawlers — explicit allow so this docs site is usable in
# ChatGPT, Claude, Perplexity, Google AI Overviews, etc.
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

# Machine-readable reference for LLMs: ${llmsURL.href}
# (a comment because there is no standardized robots.txt directive for it yet;
# AI clients discover the file at the well-known /llms.txt path, and the
# homepage also serves it via Accept: text/markdown content negotiation.)

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('sitemap-index.xml', site);
  const llmsURL = new URL('llms.txt', site);
  return new Response(getRobotsTxt(sitemapURL, llmsURL), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
