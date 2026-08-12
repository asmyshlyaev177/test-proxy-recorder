import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://test-proxy-recorder.dev';

/**
 * `<docs-url>.md` — the Markdown source of every docs page.
 *
 * Appending `.md` to a canonical docs URL is the convention the documentation
 * sites agents actually read converged on independently (Stripe, Supabase,
 * Next.js, Prisma, Clerk), and coding agents are the overwhelming majority of
 * what fetches those endpoints. It is also not a convention agents discover
 * unaided, which is what the `<link rel="alternate">` in
 * components/starlight/Head.astro is for.
 *
 * The route is a root-level catch-all so it covers every locale in one pass:
 * entry ids are `docs/...` for English and `<lang>/docs/...` for the rest,
 * which are exactly the URLs Starlight serves them at.
 *
 * Prerendered, like the docs pages themselves, so both are built from the same
 * content in the same pass and can't drift. Single-representation URLs, so —
 * unlike the negotiated homepage — they are safe to cache, and do.
 */
export const prerender = true;

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  return docs.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

/**
 * Strip the Starlight component imports from the top of an MDX body.
 *
 * They resolve to nothing outside the site's build, so to a reader they are
 * three lines of noise before the first sentence. The components themselves
 * are left in place — `<LinkCard>` still says where it points.
 */
function stripStarlightImports(body: string): string {
  return body
    .replace(/^import\s+.*from\s+['"]@astrojs\/starlight\/components['"];?\n/gm, '')
    .replace(/^\n+/, '');
}

export const GET: APIRoute = ({ props }) => {
  const { entry } = props;
  const { title, description } = entry.data;
  const canonical = `${SITE}/${entry.id}/`;

  const document = [
    `# ${title}`,
    '',
    description ? `> ${description.replace(/\s+/g, ' ').trim()}` : null,
    description ? '' : null,
    `Canonical: <${canonical}>`,
    `Docs index: <${SITE}/docs/> · All docs as one file: <${SITE}/llms-full.txt>`,
    '',
    '---',
    '',
    stripStarlightImports(entry.body ?? '').trim(),
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return new Response(document, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
