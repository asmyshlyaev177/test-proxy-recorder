import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src/content/docs');

/** Run a git command from the landing package, or return '' if git isn't usable. */
function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Not a git checkout (source tarball, or a CI image that checks out
    // without a .git directory).
    return '';
  }
}

/**
 * The date the site content last actually changed, as an ISO-8601 string.
 *
 * Read from the HEAD commit rather than `Date.now()` so `dateModified` and the
 * "Last updated" line in /llms.txt mean "the content changed then" instead of
 * "someone redeployed then" — a timestamp that moves on every rebuild is the
 * kind of freshness signal crawlers learn to discount.
 */
export function getContentLastModified() {
  ensureHistory();
  // Scoped to the site's own files: this package shares a repository with the
  // library, and a release there is not a change to any page here — yet this
  // date moved on every one. HEAD is the fallback for a clone that could not
  // be deepened, where a path-scoped log may find nothing.
  const iso = (git('log -1 --format=%cI -- src public') || git('log -1 --format=%cI')).trim();
  return iso ? new Date(iso).toISOString() : new Date().toISOString();
}

/**
 * A shallow CI clone knows one commit: a path-scoped log finds nothing and
 * every per-file date below is missing. Deepen once if the remote allows it.
 */
function ensureHistory() {
  if (git('rev-parse --is-shallow-repository').trim() !== 'true') return;
  git('fetch --unshallow --quiet');
}

/**
 * Newest commit date per tracked file under the landing package, as ISO-8601
 * strings keyed by path relative to that package.
 *
 * One `git log` walk rather than one call per file: the docs tree is ~50 pages
 * across six locales, and a per-file `git log` would mean hundreds of process
 * spawns on every build.
 */
function fileDates() {
  ensureHistory();
  // `--relative` makes the emitted paths relative to this package rather than
  // to the repository root, so they line up with what `sourceFor` builds.
  const log = git('log --relative --format=%x00%cI --name-only -- src');
  /** @type {Map<string, string>} */
  const dates = new Map();
  if (!log) return dates;

  let current = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('\0')) {
      current = new Date(line.slice(1).trim()).toISOString();
      continue;
    }
    const path = line.trim();
    // Commits are newest-first, so the first date seen for a path is its newest.
    if (path && current && !dates.has(path)) dates.set(path, current);
  }
  return dates;
}

/**
 * Resolve a URL pathname to the source file that produces it.
 *
 * Starlight serves the docs collection at a path that mirrors the collection
 * layout: `/docs/guides/cli/` comes from `src/content/docs/docs/guides/cli.md`,
 * and `/es/docs/guides/cli/` from `src/content/docs/es/docs/guides/cli.md`.
 */
function sourceFor(pathname) {
  const slug = pathname.replace(/^\/+|\/+$/g, '');
  if (slug === '') return 'src/pages/index.astro';

  for (const candidate of [
    `${slug}.md`,
    `${slug}.mdx`,
    `${slug}/index.md`,
    `${slug}/index.mdx`,
  ]) {
    if (existsSync(join(CONTENT_DIR, candidate))) {
      return `src/content/docs/${candidate}`;
    }
  }
  return undefined;
}

/**
 * A `lastmod` resolver for the sitemap's `serialize` hook.
 *
 * Without it every one of the ~265 URLs in the sitemap is dateless, so search
 * engines get no signal about which pages changed and re-crawl on their own
 * schedule instead of promptly. The generated API reference is gitignored and
 * regenerated each build, so those pages fall back to the HEAD date.
 */
export function createLastmodResolver() {
  const dates = fileDates();
  const fallback = getContentLastModified();

  return (pathname) => {
    const source = sourceFor(pathname);
    return (source && dates.get(source)) || fallback;
  };
}
