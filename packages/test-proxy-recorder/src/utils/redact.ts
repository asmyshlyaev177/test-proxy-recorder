import type http from 'node:http';

import type {
  Recording,
  RecordingSession,
  WebSocketRecording,
} from '../types.js';

/**
 * Header names (lower-cased) whose values are stripped from recordings by
 * default. These commonly carry credentials and are safe to remove: replay
 * matching ignores request/response headers, so redaction never breaks
 * playback.
 */
export const DEFAULT_REDACTED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
];

/** Value written in place of a redacted secret. */
export const REDACTED_PLACEHOLDER = '[REDACTED]';

const COOKIE_HEADERS = new Set(['cookie', 'set-cookie']);

export interface RedactionConfig {
  /**
   * Additional header names (case-insensitive) to redact. Merged with
   * {@link DEFAULT_REDACTED_HEADERS} — the defaults always apply while
   * enabled.
   */
  headers?: string[];
  /**
   * Header names (case-insensitive) to leave untouched even if they would
   * otherwise be redacted. Use to exempt a header from the defaults, e.g.
   * `['set-cookie']` when no session cookie is set on responses.
   */
  allowHeaders?: string[];
  /**
   * Cookie names (case-insensitive) to keep unredacted inside the `Cookie`
   * and `Set-Cookie` headers. Every other cookie in those headers still has
   * its value replaced. Use this when only some cookies are sensitive — e.g.
   * keep a `theme` or A/B-test cookie while redacting the session cookie.
   */
  allowCookies?: string[];
  /**
   * Patterns matched against request/response bodies (and WebSocket message
   * payloads). Every match is replaced with the placeholder. Strings are
   * treated as global regular expressions. Use this for API keys or tokens
   * embedded in payloads.
   */
  bodyPatterns?: (RegExp | string)[];
  /** Replacement string. Defaults to {@link REDACTED_PLACEHOLDER}. */
  placeholder?: string;
}

interface ResolvedRedaction {
  headerSet: Set<string>;
  allowCookies: Set<string>;
  regexes: RegExp[];
  placeholder: string;
}

function resolveRedaction(config?: RedactionConfig): ResolvedRedaction {
  const extra = (config?.headers ?? []).map((name) => name.toLowerCase());
  const headerSet = new Set([...DEFAULT_REDACTED_HEADERS, ...extra]);
  for (const name of config?.allowHeaders ?? []) {
    headerSet.delete(name.toLowerCase());
  }

  return {
    headerSet,
    allowCookies: new Set(
      (config?.allowCookies ?? []).map((name) => name.toLowerCase()),
    ),
    regexes: toGlobalRegexes(config?.bodyPatterns),
    placeholder: config?.placeholder ?? REDACTED_PLACEHOLDER,
  };
}

function toGlobalRegexes(patterns?: (RegExp | string)[]): RegExp[] {
  if (!patterns || patterns.length === 0) {
    return [];
  }
  return patterns.map((pattern) => {
    if (typeof pattern === 'string') {
      return new RegExp(pattern, 'g');
    }
    // Ensure the regex is global so every occurrence is replaced.
    return pattern.flags.includes('g')
      ? pattern
      : new RegExp(pattern.source, `${pattern.flags}g`);
  });
}

/**
 * Redact a request `Cookie` header (`name=value; name2=value2`), keeping the
 * values of any allow-listed cookie names.
 */
function redactCookieHeader(
  value: string,
  allowCookies: Set<string>,
  placeholder: string,
): string {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        return pair;
      }
      const name = pair.slice(0, eq);
      return allowCookies.has(name.toLowerCase())
        ? pair
        : `${name}=${placeholder}`;
    })
    .join('; ');
}

/**
 * Redact one `Set-Cookie` value (`name=value; Path=/; HttpOnly`), keeping the
 * attributes and replacing only the cookie value — unless its name is
 * allow-listed.
 */
function redactSetCookieValue(
  value: string,
  allowCookies: Set<string>,
  placeholder: string,
): string {
  const semicolon = value.indexOf(';');
  const firstPair = semicolon === -1 ? value : value.slice(0, semicolon);
  const attributes = semicolon === -1 ? '' : value.slice(semicolon);
  const eq = firstPair.indexOf('=');
  if (eq === -1) {
    return value;
  }
  const name = firstPair.slice(0, eq).trim();
  if (allowCookies.has(name.toLowerCase())) {
    return value;
  }
  return `${name}=${placeholder}${attributes}`;
}

/**
 * Cookie-aware partial redaction: keep allow-listed cookie names, redact the
 * rest. `cookie` request headers list many cookies in one string; `set-cookie`
 * is one cookie (with attributes) per value.
 */
function redactCookieAware(
  lower: string,
  value: http.IncomingHttpHeaders[string],
  resolved: ResolvedRedaction,
): http.IncomingHttpHeaders[string] {
  const { allowCookies, placeholder } = resolved;
  const redactOne = (cookie: string): string =>
    lower === 'cookie'
      ? redactCookieHeader(cookie, allowCookies, placeholder)
      : redactSetCookieValue(cookie, allowCookies, placeholder);

  return Array.isArray(value)
    ? value.map((v) => redactOne(v))
    : redactOne(String(value));
}

function redactHeaderValue(
  name: string,
  value: http.IncomingHttpHeaders[string],
  resolved: ResolvedRedaction,
): http.IncomingHttpHeaders[string] {
  const lower = name.toLowerCase();

  if (resolved.allowCookies.size > 0 && COOKIE_HEADERS.has(lower)) {
    return redactCookieAware(lower, value, resolved);
  }

  // Whole-value redaction (preserve array shape, e.g. multiple Set-Cookie).
  return Array.isArray(value)
    ? value.map(() => resolved.placeholder)
    : resolved.placeholder;
}

function redactHeaders(
  headers: http.IncomingHttpHeaders,
  resolved: ResolvedRedaction,
): http.IncomingHttpHeaders {
  const result: http.IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name] = resolved.headerSet.has(name.toLowerCase())
      ? redactHeaderValue(name, value, resolved)
      : value;
  }
  return result;
}

function redactBody(
  body: string | null | undefined,
  regexes: RegExp[],
  placeholder: string,
): string | null {
  if (!body || regexes.length === 0) {
    return body ?? null;
  }
  let result = body;
  for (const regex of regexes) {
    // Reset lastIndex so reused regex instances don't skip matches.
    regex.lastIndex = 0;
    result = result.replace(regex, placeholder);
  }
  return result;
}

function redactRecording(
  recording: Recording,
  resolved: ResolvedRedaction,
): Recording {
  const { regexes, placeholder } = resolved;
  return {
    ...recording,
    request: {
      ...recording.request,
      headers: redactHeaders(recording.request.headers, resolved),
      body: redactBody(recording.request.body, regexes, placeholder),
    },
    response: recording.response && {
      ...recording.response,
      headers: redactHeaders(recording.response.headers, resolved),
      body: redactBody(recording.response.body, regexes, placeholder),
    },
  };
}

function redactWebSocketRecording(
  recording: WebSocketRecording,
  resolved: ResolvedRedaction,
): WebSocketRecording {
  const { regexes, placeholder } = resolved;
  return {
    ...recording,
    headers: recording.headers
      ? redactHeaders(recording.headers, resolved)
      : recording.headers,
    messages: recording.messages.map((message) => ({
      ...message,
      data: redactBody(message.data, regexes, placeholder) ?? message.data,
    })),
  };
}

/**
 * Redact a single flat header value (one `name: value` pair, as found in HAR
 * `headers` arrays) using the resolved config. Cookie headers keep their
 * allow-listed cookies; every other targeted header collapses to the
 * placeholder.
 */
function redactHeaderString(
  name: string,
  value: string,
  resolved: ResolvedRedaction,
): string {
  const lower = name.toLowerCase();
  if (resolved.allowCookies.size > 0 && COOKIE_HEADERS.has(lower)) {
    return lower === 'cookie'
      ? redactCookieHeader(value, resolved.allowCookies, resolved.placeholder)
      : redactSetCookieValue(
          value,
          resolved.allowCookies,
          resolved.placeholder,
        );
  }
  return resolved.placeholder;
}

/** Minimal structural typing for the parts of a HAR file we touch. */
interface HarNameValue {
  name: string;
  value: string;
}
interface HarEntry {
  request?: {
    headers?: HarNameValue[];
    cookies?: HarNameValue[];
    postData?: { text?: string } & Record<string, unknown>;
  } & Record<string, unknown>;
  response?: {
    headers?: HarNameValue[];
    cookies?: HarNameValue[];
    content?: { text?: string; encoding?: string } & Record<string, unknown>;
  } & Record<string, unknown>;
}
export interface Har {
  log?: { entries?: HarEntry[] } & Record<string, unknown>;
}

function redactHarHeaders(
  headers: HarNameValue[] | undefined,
  resolved: ResolvedRedaction,
): HarNameValue[] | undefined {
  if (!headers) {
    return headers;
  }
  return headers.map((header) =>
    resolved.headerSet.has(header.name.toLowerCase())
      ? {
          ...header,
          value: redactHeaderString(header.name, header.value, resolved),
        }
      : header,
  );
}

/**
 * Redact a HAR `cookies` array. Only runs when the corresponding cookie header
 * (`cookie` for requests, `set-cookie` for responses) is itself being redacted,
 * so `allowHeaders: ['cookie']` keeps the array intact too.
 */
function redactHarCookies(
  cookies: HarNameValue[] | undefined,
  resolved: ResolvedRedaction,
  enabledForThisSide: boolean,
): HarNameValue[] | undefined {
  if (!cookies || !enabledForThisSide) {
    return cookies;
  }
  return cookies.map((cookie) =>
    resolved.allowCookies.has(cookie.name.toLowerCase())
      ? cookie
      : { ...cookie, value: resolved.placeholder },
  );
}

/**
 * Return a redacted copy of a parsed HAR file. Mirrors {@link redactSession}
 * for the `.har` files Playwright writes via `routeFromHAR`: redacts the same
 * headers/cookies and applies body patterns to request `postData` and response
 * `content`. The input is not mutated. `config.enabled === false` is a no-op.
 */
export function redactHar(har: Har, config?: RedactionConfig | false): Har {
  // Redaction is opt-in: a config object (even `{}`) enables it; `false` or
  // `undefined` is a no-op.
  if (!config || !har?.log?.entries) {
    return har;
  }
  const resolved = resolveRedaction(config);
  const { regexes, placeholder } = resolved;

  const entries = har.log.entries.map((entry) => {
    const request = entry.request && {
      ...entry.request,
      headers: redactHarHeaders(entry.request.headers, resolved),
      cookies: redactHarCookies(
        entry.request.cookies,
        resolved,
        resolved.headerSet.has('cookie'),
      ),
      postData: entry.request.postData && {
        ...entry.request.postData,
        text:
          redactBody(entry.request.postData.text, regexes, placeholder) ??
          entry.request.postData.text,
      },
    };

    const content = entry.response?.content;
    const response = entry.response && {
      ...entry.response,
      headers: redactHarHeaders(entry.response.headers, resolved),
      cookies: redactHarCookies(
        entry.response.cookies,
        resolved,
        resolved.headerSet.has('set-cookie'),
      ),
      content: content && {
        ...content,
        // Body patterns only apply to text payloads; base64 is left as-is.
        text:
          content.encoding === 'base64'
            ? content.text
            : (redactBody(content.text, regexes, placeholder) ?? content.text),
      },
    };

    return { ...entry, request, response };
  });

  return { ...har, log: { ...har.log, entries } };
}

/**
 * JSON-safe form of {@link RedactionConfig} for sending over the `/__control`
 * endpoint. `bodyPatterns` (which may be `RegExp`) become `{ source, flags }`.
 */
export interface SerializedRedactionConfig {
  headers?: string[];
  allowHeaders?: string[];
  allowCookies?: string[];
  bodyPatterns?: { source: string; flags: string }[];
  placeholder?: string;
}

/**
 * Serialize for the `/__control` wire. A redaction object becomes a
 * JSON-safe object (enabled); `false`/`undefined` becomes `false` (disabled).
 */
export function serializeRedactionConfig(
  config?: RedactionConfig | false,
): SerializedRedactionConfig | false {
  if (!config) {
    return false;
  }
  const { bodyPatterns, ...rest } = config;
  return {
    ...rest,
    bodyPatterns: bodyPatterns?.map((pattern) =>
      typeof pattern === 'string'
        ? { source: pattern, flags: 'g' }
        : { source: pattern.source, flags: pattern.flags },
    ),
  };
}

export function deserializeRedactionConfig(
  config?: SerializedRedactionConfig | false,
): RedactionConfig | undefined {
  if (!config) {
    return undefined;
  }
  const { bodyPatterns, ...rest } = config;
  return {
    ...rest,
    bodyPatterns: bodyPatterns?.map(
      ({ source, flags }) => new RegExp(source, flags),
    ),
  };
}

/**
 * Return a redacted copy of a recording session. Sensitive headers are
 * stripped and any configured body patterns replaced. The input is not
 * mutated. Redaction is opt-in: a config object (even `{}`) enables it, while
 * `false`/`undefined` returns the session unchanged.
 */
export function redactSession(
  session: RecordingSession,
  config?: RedactionConfig | false,
): RecordingSession {
  if (!config) {
    return session;
  }

  const resolved = resolveRedaction(config);

  return {
    ...session,
    recordings: session.recordings.map((recording) =>
      redactRecording(recording, resolved),
    ),
    websocketRecordings: (session.websocketRecordings ?? []).map((recording) =>
      redactWebSocketRecording(recording, resolved),
    ),
  };
}
