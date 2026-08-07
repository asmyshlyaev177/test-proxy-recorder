import type { APIRoute } from 'astro';

const getRobotsTxt = (site: URL, sitemapURL: URL, llmsURL: URL) => `\
# Content Signals — https://contentsignals.org/
#   search   = indexing this site and showing links plus short excerpts
#   ai-train = training or fine-tuning a model
#   ai-input = grounding a generative answer at request time (RAG)
# All three are granted. This is documentation: being quoted back to someone
# debugging a recorded proxy fixture at 2am is the job. Allow/Disallow govern
# fetching, these govern what may be done with what was fetched.
#
# The AI crawlers used to get one named group each. RFC 9309 §2.2.1 says
# a crawler obeys only its most specific matching group and ignores every
# other, so those groups hid this directive from exactly the crawlers it is
# addressed to. One group for everyone is correct.
User-agent: *
Content-Signal: search=yes, ai-train=yes, ai-input=yes
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
