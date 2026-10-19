import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Request, Route } from '@playwright/test';

import { stripMultipartBoundary } from '../utils/httpHelpers.js';
import type { Har, HarEntry, HarNameValue } from '../utils/redact.js';

// Methods that leave the server as they found it; everything else is a write.
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The parts of a request that replay matches on. */
export interface ReplayRequest {
  method: string;
  url: string;
  body: string;
  headers: HarNameValue[];
}

function headerValue(
  headers: HarNameValue[],
  name: string,
): string | undefined {
  return headers.find((header) => header.name.toLowerCase() === name)?.value;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

// `POST /todos` changes what `GET /todos` and `GET /todos/1` return; `POST /log` does not.
function isRelatedPath(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function headerKeys(headers: HarNameValue[]): string[] {
  return headers.map(
    (header) => `${header.name.toLowerCase()}:${header.value}`,
  );
}

interface IndexedEntry {
  entry: HarEntry;
  method: string;
  url: string;
  path: string;
  body: string;
  headers: Set<string>;
  isWrite: boolean;
}

function indexEntry(entry: HarEntry): IndexedEntry {
  const request = entry.request ?? {};
  const headers = request.headers ?? [];
  const method = (request.method ?? 'GET').toUpperCase();
  const url = request.url ?? '';
  return {
    entry,
    method,
    url,
    path: pathOf(url),
    body: stripMultipartBoundary(
      request.postData?.text ?? '',
      headerValue(headers, 'content-type'),
    ),
    headers: new Set(headerKeys(headers)),
    isWrite: !READ_METHODS.has(method),
  };
}

interface Candidate {
  index: number;
  /** Request headers the entry carries with the same value. */
  shared: number;
}

/**
 * Hands out a HAR's entries in recorded order, one per request. Playwright's
 * own replay picks the same entry for every repeat of a request, so a read after
 * a write showed the state before it (microsoft/playwright#18288).
 */
export class HarReplaySequence {
  private readonly entries: IndexedEntry[];
  private readonly served = new Set<number>();

  constructor(entries: HarEntry[]) {
    this.entries = entries.map((entry) => indexEntry(entry));
  }

  next(request: ReplayRequest): HarEntry | undefined {
    const index = this._pick(this._candidates(request), pathOf(request.url));
    if (index === undefined) return undefined;
    this._markServed(index);
    return this.entries[index].entry;
  }

  // Same method and URL, and the same body when any entry has it: a body no
  // entry has (a timestamp, a client-made id) still matches by method and URL.
  private _candidates(request: ReplayRequest): Candidate[] {
    const method = request.method.toUpperCase();
    const body = stripMultipartBoundary(
      request.body,
      headerValue(request.headers, 'content-type'),
    );
    const sent = headerKeys(request.headers);
    const sameUrl = this.entries.flatMap((entry, index) =>
      entry.method === method && entry.url === request.url
        ? [
            {
              index,
              shared: sent.filter((key) => entry.headers.has(key)).length,
            },
          ]
        : [],
    );
    const sameBody = sameUrl.filter(
      (candidate) => this.entries[candidate.index].body === body,
    );
    return sameBody.length > 0 ? sameBody : sameUrl;
  }

  // Only the entries sharing the most request headers are in play: the same URL
  // and body can be different operations told apart by a header. Among those,
  // unserved copies first, but never past an unreplayed write to a related path;
  // the app may read fewer or more times than the recording did before writing,
  // so a read that would cross that write reuses the latest copy before it.
  private _pick(candidates: Candidate[], path: string): number | undefined {
    const top = Math.max(...candidates.map((candidate) => candidate.shared));
    const matching = candidates
      .filter((candidate) => candidate.shared === top)
      .map((candidate) => candidate.index);
    const barrier = this._nextWrite(path);
    const fresh = matching.filter((index) => !this.served.has(index));
    const replayed = matching.filter(
      (index) => this.served.has(index) && index < barrier,
    );
    return (
      fresh.find((index) => index <= barrier) ??
      replayed.at(-1) ??
      fresh[0] ??
      matching.at(-1)
    );
  }

  private _nextWrite(path: string): number {
    const index = this.entries.findIndex(
      (entry, position) =>
        !this.served.has(position) &&
        entry.isWrite &&
        isRelatedPath(entry.path, path),
    );
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  }

  // Once a write is replayed, earlier entries on related paths describe a state the app has left.
  private _markServed(index: number): void {
    this.served.add(index);
    const write = this.entries[index];
    if (!write.isWrite) return;
    for (let earlier = 0; earlier < index; earlier++) {
      if (isRelatedPath(this.entries[earlier].path, write.path)) {
        this.served.add(earlier);
      }
    }
  }
}

function requestOf(request: Request): ReplayRequest {
  return {
    method: request.method(),
    url: request.url(),
    body: request.postData() ?? '',
    headers: Object.entries(request.headers()).map(([name, value]) => ({
      name,
      value,
    })),
  };
}

// An unparseable Location is served as recorded rather than thrown from the route handler.
function resolveLocation(location: string, base: string): string | undefined {
  try {
    return new URL(location, base).toString();
  } catch {
    return undefined;
  }
}

/** The request the browser would make next for a recorded redirect, or nothing when the entry is not one. */
function redirectOf(
  entry: HarEntry,
  request: ReplayRequest,
): ReplayRequest | undefined {
  const status = entry.response?.status ?? 0;
  const location = headerValue(entry.response?.headers ?? [], 'location');
  // The live URL is the base: it equals the recorded one for a match, and is always present.
  const target = location && resolveLocation(location, request.url);
  if (!REDIRECT_STATUSES.has(status) || !target) return undefined;
  // The browser drops the body and switches to GET on these, as Playwright's HAR router does.
  const toGet =
    ((status === 301 || status === 302) && request.method === 'POST') ||
    (status === 303 && !['GET', 'HEAD'].includes(request.method));
  return {
    ...request,
    url: target,
    method: toGet ? 'GET' : request.method,
    body: toGet ? '' : request.body,
  };
}

interface Resolved {
  entry: HarEntry;
  /** Set when a navigation was recorded as a redirect: the browser must go there itself. */
  navigateTo?: string;
}

// A redirect's follow-up request never reaches `page.route`, so the chain is
// walked inside the HAR: a fetch gets the final response, a navigation is sent
// on to the next URL. A chain that revisits an entry resolves to nothing.
function resolveEntry(
  sequence: HarReplaySequence,
  request: ReplayRequest,
  isNavigation: boolean,
): Resolved | undefined {
  const visited = new Set<HarEntry>();
  let current = request;
  let entry = sequence.next(current);
  let redirect = entry && redirectOf(entry, current);
  while (entry && redirect && !isNavigation && !visited.has(entry)) {
    visited.add(entry);
    current = redirect;
    entry = sequence.next(current);
    redirect = entry && redirectOf(entry, current);
  }
  if (!entry || (redirect && visited.has(entry))) return undefined;
  return redirect ? { entry, navigateTo: redirect.url } : { entry };
}

function fulfillHeaders(headers: HarNameValue[] = []): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { name, value } of headers) {
    const key = name.toLowerCase();
    // Repeated Set-Cookie headers fold into one, newline-separated, as Playwright's own HAR router sends them.
    result[key] =
      key === 'set-cookie' && result[key] ? `${result[key]}\n${value}` : value;
  }
  return result;
}

function entryBody(entry: HarEntry): Buffer {
  const content = entry.response?.content;
  return Buffer.from(
    content?.text ?? '',
    content?.encoding === 'base64' ? 'base64' : 'utf8',
  );
}

async function fulfillFromEntry(route: Route, entry: HarEntry): Promise<void> {
  const status = entry.response?.status ?? 0;
  // A request that failed while recording has no status to serve, so it fails again.
  if (status <= 0) {
    await route.abort();
    return;
  }
  await route.fulfill({
    status,
    headers: fulfillHeaders(entry.response?.headers),
    body: entryBody(entry),
  });
}

// Playwright's HAR router restarts a redirected navigation at the new URL through
// an internal call; a refresh page makes the browser do the same through `page.route`.
// A serialized URL holds no quote or angle bracket, so it is safe inside the attribute.
async function fulfillNavigationRedirect(
  route: Route,
  url: string,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><meta http-equiv="refresh" content="0; url=${url}">`,
  });
}

/** A `page.route` handler that answers each request with the next recorded entry for it. */
export function createHarReplayHandler(
  entries: HarEntry[],
): (route: Route) => Promise<void> {
  const sequence = new HarReplaySequence(entries);
  return async (route) => {
    const request = route.request();
    const resolved = resolveEntry(
      sequence,
      requestOf(request),
      request.isNavigationRequest(),
    );
    if (!resolved) {
      console.error(
        `[Client-Side Replay] No recorded response for ${request.method()} ${request.url()}. Re-record this test.`,
      );
      await route.abort();
      return;
    }
    await (resolved.navigateTo
      ? fulfillNavigationRedirect(route, resolved.navigateTo)
      : fulfillFromEntry(route, resolved.entry));
  };
}

// This library records with `updateContent: 'embed'`, but a HAR written with
// `attach` keeps each body in a file beside it. Read those in once so serving stays synchronous.
async function embedSidecar(entry: HarEntry, harDir: string): Promise<void> {
  const content = entry.response?.content;
  const file = content?._file;
  if (!content || typeof file !== 'string') return;
  const body = await fs.readFile(path.join(harDir, file));
  content.text = body.toString('base64');
  content.encoding = 'base64';
}

/** The entries of a `.har`, with any sidecar bodies read in. */
export async function loadHarEntries(harPath: string): Promise<HarEntry[]> {
  const har = JSON.parse(await fs.readFile(harPath, 'utf8')) as Har;
  const entries = har.log?.entries ?? [];
  await Promise.all(
    entries.map((entry) => embedSidecar(entry, path.dirname(harPath))),
  );
  return entries;
}
