import type { APIRoute } from 'astro';

const getRobotsTxt = (site: URL, sitemapURL: URL, llmsURL: URL) => `\
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

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: YouBot
Allow: /

# Machine-readable reference for LLMs: ${llmsURL.href}
# (a comment because there is no standardized robots.txt directive for it yet;
# AI clients discover the file at the well-known /llms.txt path, and the
# homepage also serves it via Accept: text/markdown content negotiation.)
#
# The full documentation as one Markdown file:
#   ${new URL('llms-full.txt', site).href}
#
# The rest of the AI Discovery Files published on this host
# (https://www.ai-visibility.org.uk/specifications/):
#   ${new URL('ai.txt', site).href}
#   ${new URL('ai.json', site).href}
#   ${new URL('identity.json', site).href}
#   ${new URL('brand.txt', site).href}
#   ${new URL('faq-ai.txt', site).href}
#   ${new URL('developer-ai.txt', site).href}
#   ${new URL('robots-ai.txt', site).href}

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const base = site as URL;
  const sitemapURL = new URL('sitemap-index.xml', base);
  const llmsURL = new URL('llms.txt', base);
  return new Response(getRobotsTxt(base, sitemapURL, llmsURL), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
