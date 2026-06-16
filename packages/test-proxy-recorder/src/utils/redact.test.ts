import { describe, expect, it } from 'vitest';

import type { RecordingSession } from '../types.js';
import {
  deserializeRedactionConfig,
  type Har,
  REDACTED_PLACEHOLDER,
  redactHar,
  type RedactionConfig,
  redactSession,
  serializeRedactionConfig,
} from './redact.js';

// Redaction is opt-in: passing a config object (even `{}`) enables it, while
// `false`/`undefined` is a no-op. `on()` just supplies that object so each test
// exercises the redacting path; the no-op behavior is covered explicitly.
const on = (config: RedactionConfig = {}): RedactionConfig => config;

function makeHar(overrides: Partial<Har['log']> = {}): Har {
  return {
    log: {
      version: '1.2',
      entries: [
        {
          request: {
            method: 'POST',
            url: 'https://api.example.com/login',
            headers: [
              { name: 'authorization', value: 'Bearer secret-token' },
              { name: 'cookie', value: 'session=abc123; theme=dark' },
              { name: 'accept', value: '*/*' },
            ],
            cookies: [
              { name: 'session', value: 'abc123' },
              { name: 'theme', value: 'dark' },
            ],
            postData: {
              mimeType: 'application/json',
              text: '{"key":"sk_live_abc123"}',
            },
          },
          response: {
            status: 200,
            headers: [
              { name: 'content-type', value: 'application/json' },
              { name: 'set-cookie', value: 'refresh=xyz; HttpOnly' },
            ],
            cookies: [{ name: 'refresh', value: 'xyz' }],
            content: {
              mimeType: 'application/json',
              text: '{"token":"sk_live_abc123"}',
            },
          },
        },
      ],
      ...overrides,
    },
  } as Har;
}

function makeSession(
  overrides: Partial<RecordingSession> = {},
): RecordingSession {
  return {
    id: 'test-session',
    recordings: [
      {
        request: {
          method: 'POST',
          url: '/login',
          headers: {
            host: 'localhost:8100',
            authorization: 'Bearer secret-token',
            cookie: 'session=abc123',
            accept: '*/*',
          },
          body: '{"password":"hunter2"}',
        },
        response: {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': ['refresh=xyz; HttpOnly', 'theme=dark'],
          },
          body: '{"token":"jwt-abc"}',
        },
        timestamp: '2026-06-13T00:00:00.000Z',
        key: 'POST_login.json',
        recordingId: 0,
        sequence: 0,
      },
    ],
    websocketRecordings: [],
    ...overrides,
  };
}

describe('redactSession', () => {
  it('redacts default sensitive headers on request and response', () => {
    const result = redactSession(makeSession(), on());
    const { request, response } = result.recordings[0];

    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
    expect(request.headers.cookie).toBe(REDACTED_PLACEHOLDER);
    // Non-sensitive headers are untouched.
    expect(request.headers.accept).toBe('*/*');
    expect(request.headers.host).toBe('localhost:8100');
    // Array-valued headers keep their shape.
    expect(response?.headers['set-cookie']).toEqual([
      REDACTED_PLACEHOLDER,
      REDACTED_PLACEHOLDER,
    ]);
    expect(response?.headers['content-type']).toBe('application/json');
  });

  it('is case-insensitive for header names', () => {
    const session = makeSession();
    session.recordings[0].request.headers = {
      Authorization: 'Bearer secret-token',
      Cookie: 'session=abc123',
    };

    const { request } = redactSession(session, on()).recordings[0];
    expect(request.headers.Authorization).toBe(REDACTED_PLACEHOLDER);
    expect(request.headers.Cookie).toBe(REDACTED_PLACEHOLDER);
  });

  it('does not mutate the original session', () => {
    const session = makeSession();
    redactSession(session, on());
    expect(session.recordings[0].request.headers.authorization).toBe(
      'Bearer secret-token',
    );
  });

  it('is a no-op when redaction is off (false or undefined)', () => {
    const session = makeSession();
    expect(redactSession(session)).toBe(session); // omitted
    expect(redactSession(session, false)).toBe(session); // explicit false
    expect(session.recordings[0].request.headers.authorization).toBe(
      'Bearer secret-token',
    );
  });

  it('redacts when given any config object, including {}', () => {
    const { request } = redactSession(makeSession(), {}).recordings[0];
    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
  });

  it('redacts additional configured headers alongside the defaults', () => {
    const session = makeSession();
    session.recordings[0].request.headers['x-api-key'] = 'super-secret';

    const { request } = redactSession(session, on({ headers: ['X-API-Key'] }))
      .recordings[0];

    expect(request.headers['x-api-key']).toBe(REDACTED_PLACEHOLDER);
    // Defaults still apply.
    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
  });

  it('redacts body matches via configured patterns', () => {
    const session = makeSession();
    const result = redactSession(
      session,
      on({ bodyPatterns: ['hunter2', /jwt-[a-z]+/] }),
    );

    expect(result.recordings[0].request.body).toBe(
      `{"password":"${REDACTED_PLACEHOLDER}"}`,
    );
    expect(result.recordings[0].response?.body).toBe(
      `{"token":"${REDACTED_PLACEHOLDER}"}`,
    );
  });

  it('exempts allow-listed headers from redaction', () => {
    const result = redactSession(
      makeSession(),
      on({ allowHeaders: ['set-cookie'] }),
    );
    const { request, response } = result.recordings[0];

    // set-cookie is exempted...
    expect(response?.headers['set-cookie']).toEqual([
      'refresh=xyz; HttpOnly',
      'theme=dark',
    ]);
    // ...but other defaults still redact.
    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
    expect(request.headers.cookie).toBe(REDACTED_PLACEHOLDER);
  });

  it('redacts only sensitive cookies when allowCookies is set', () => {
    const session = makeSession();
    session.recordings[0].request.headers.cookie =
      'session=abc123; theme=dark; ab_test=42';

    const { request, response } = redactSession(
      session,
      on({ allowCookies: ['theme', 'ab_test'] }),
    ).recordings[0];

    // Request Cookie: session redacted, theme/ab_test preserved.
    expect(request.headers.cookie).toBe(
      `session=${REDACTED_PLACEHOLDER}; theme=dark; ab_test=42`,
    );
    // Response Set-Cookie: refresh value redacted (attributes kept),
    // theme kept entirely.
    expect(response?.headers['set-cookie']).toEqual([
      `refresh=${REDACTED_PLACEHOLDER}; HttpOnly`,
      'theme=dark',
    ]);
    // Non-cookie sensitive headers are unaffected by allowCookies.
    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
  });

  it('supports a custom placeholder', () => {
    const { request } = redactSession(makeSession(), on({ placeholder: '***' }))
      .recordings[0];
    expect(request.headers.authorization).toBe('***');
  });

  it('redacts WebSocket headers and message payloads', () => {
    const session = makeSession({
      recordings: [],
      websocketRecordings: [
        {
          url: '/ws',
          headers: { authorization: 'Bearer ws-token', accept: '*/*' },
          messages: [
            {
              direction: 'client-to-server',
              data: 'auth hunter2',
              timestamp: '2026-06-13T00:00:00.000Z',
            },
          ],
          timestamp: '2026-06-13T00:00:00.000Z',
          key: 'WS__ws',
        },
      ],
    });

    const ws = redactSession(session, on({ bodyPatterns: ['hunter2'] }))
      .websocketRecordings[0];
    expect(ws.headers?.authorization).toBe(REDACTED_PLACEHOLDER);
    expect(ws.messages[0].data).toBe(`auth ${REDACTED_PLACEHOLDER}`);
  });
});

function firstEntry(har: Har) {
  return har.log!.entries![0];
}

describe('redactHar', () => {
  it('redacts default sensitive headers on request and response', () => {
    const entry = firstEntry(redactHar(makeHar(), on()));
    const reqHeader = (name: string) =>
      entry.request!.headers!.find((h) => h.name === name)!.value;
    const resHeader = (name: string) =>
      entry.response!.headers!.find((h) => h.name === name)!.value;

    expect(reqHeader('authorization')).toBe(REDACTED_PLACEHOLDER);
    expect(reqHeader('cookie')).toBe(REDACTED_PLACEHOLDER);
    expect(reqHeader('accept')).toBe('*/*'); // untouched
    expect(resHeader('set-cookie')).toBe(REDACTED_PLACEHOLDER);
    expect(resHeader('content-type')).toBe('application/json');
  });

  it('redacts the parsed cookies arrays too', () => {
    const entry = firstEntry(redactHar(makeHar(), on()));
    expect(entry.request!.cookies).toEqual([
      { name: 'session', value: REDACTED_PLACEHOLDER },
      { name: 'theme', value: REDACTED_PLACEHOLDER },
    ]);
    expect(entry.response!.cookies).toEqual([
      { name: 'refresh', value: REDACTED_PLACEHOLDER },
    ]);
  });

  it('keeps allow-listed cookies in both headers and the cookies array', () => {
    const entry = firstEntry(
      redactHar(makeHar(), on({ allowCookies: ['theme'] })),
    );
    const cookieHeader = entry.request!.headers!.find(
      (h) => h.name === 'cookie',
    )!.value;
    expect(cookieHeader).toBe(`session=${REDACTED_PLACEHOLDER}; theme=dark`);
    expect(entry.request!.cookies).toContainEqual({
      name: 'theme',
      value: 'dark',
    });
    expect(entry.request!.cookies).toContainEqual({
      name: 'session',
      value: REDACTED_PLACEHOLDER,
    });
  });

  it('applies body patterns to request postData and response content', () => {
    const entry = firstEntry(
      redactHar(makeHar(), on({ bodyPatterns: [/sk_live_\w+/g] })),
    );
    expect(entry.request!.postData!.text).toBe(
      `{"key":"${REDACTED_PLACEHOLDER}"}`,
    );
    expect(entry.response!.content!.text).toBe(
      `{"token":"${REDACTED_PLACEHOLDER}"}`,
    );
  });

  it('leaves base64-encoded response content untouched by body patterns', () => {
    const har = makeHar();
    har.log!.entries![0].response!.content = {
      mimeType: 'image/png',
      encoding: 'base64',
      text: 'c2tfbGl2ZV9hYmM=',
    };
    const entry = firstEntry(redactHar(har, on({ bodyPatterns: [/c2t/g] })));
    expect(entry.response!.content!.text).toBe('c2tfbGl2ZV9hYmM=');
  });

  it('is a no-op when redaction is off (false or undefined)', () => {
    const har = makeHar();
    expect(redactHar(har)).toBe(har); // omitted
    expect(redactHar(har, false)).toBe(har); // explicit false
  });

  it('redacts when given any config object, including {}', () => {
    const entry = firstEntry(redactHar(makeHar(), {}));
    expect(
      entry.request!.headers!.find((h) => h.name === 'authorization')!.value,
    ).toBe(REDACTED_PLACEHOLDER);
  });

  it('does not mutate the input', () => {
    const har = makeHar();
    redactHar(har, on());
    expect(har.log!.entries![0].request!.headers![0].value).toBe(
      'Bearer secret-token',
    );
  });
});

describe('redaction config serialization', () => {
  it('round-trips through serialize/deserialize, preserving regex flags', () => {
    const serialized = serializeRedactionConfig({
      headers: ['x-api-key'],
      allowCookies: ['theme'],
      bodyPatterns: [/sk_live_\w+/gi, 'plain-string'],
    });

    // JSON-safe: patterns are { source, flags }, survives a stringify round-trip.
    // eslint-disable-next-line unicorn/prefer-structured-clone -- intentional JSON round-trip to mirror the /__control wire format
    const overWire = JSON.parse(JSON.stringify(serialized)) as Exclude<
      typeof serialized,
      false
    >;
    expect(overWire!.bodyPatterns).toEqual([
      { source: String.raw`sk_live_\w+`, flags: 'gi' },
      { source: 'plain-string', flags: 'g' },
    ]);

    const restored = deserializeRedactionConfig(overWire);
    expect(restored!.headers).toEqual(['x-api-key']);
    const patterns = restored!.bodyPatterns as RegExp[];
    expect(patterns[0]).toBeInstanceOf(RegExp);
    expect(patterns[0].flags).toContain('i');

    // The restored config redacts the same way the original would.
    const entry = firstEntry(redactHar(makeHar(), restored));
    expect(entry.response!.content!.text).toBe(
      `{"token":"${REDACTED_PLACEHOLDER}"}`,
    );
  });

  it('maps a disabled config to/from `false` on the wire', () => {
    // Off (false/undefined) serializes to `false`; deserializing it (or
    // `undefined`) yields `undefined`, which downstream treats as "no redaction".
    expect(serializeRedactionConfig(undefined)).toBe(false);
    expect(serializeRedactionConfig(false)).toBe(false);
    expect(deserializeRedactionConfig(false)).toBeUndefined();
    expect(deserializeRedactionConfig(undefined)).toBeUndefined();
  });
});
