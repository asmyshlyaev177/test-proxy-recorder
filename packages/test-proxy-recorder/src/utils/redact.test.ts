import { describe, expect, it } from 'vitest';

import type { RecordingSession } from '../types.js';
import { REDACTED_PLACEHOLDER, redactSession } from './redact.js';

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
    const result = redactSession(makeSession());
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

    const { request } = redactSession(session).recordings[0];
    expect(request.headers.Authorization).toBe(REDACTED_PLACEHOLDER);
    expect(request.headers.Cookie).toBe(REDACTED_PLACEHOLDER);
  });

  it('does not mutate the original session', () => {
    const session = makeSession();
    redactSession(session);
    expect(session.recordings[0].request.headers.authorization).toBe(
      'Bearer secret-token',
    );
  });

  it('leaves the session untouched when disabled', () => {
    const session = makeSession();
    const result = redactSession(session, { enabled: false });
    expect(result).toBe(session);
    expect(result.recordings[0].request.headers.authorization).toBe(
      'Bearer secret-token',
    );
  });

  it('redacts additional configured headers alongside the defaults', () => {
    const session = makeSession();
    session.recordings[0].request.headers['x-api-key'] = 'super-secret';

    const { request } = redactSession(session, {
      headers: ['X-API-Key'],
    }).recordings[0];

    expect(request.headers['x-api-key']).toBe(REDACTED_PLACEHOLDER);
    // Defaults still apply.
    expect(request.headers.authorization).toBe(REDACTED_PLACEHOLDER);
  });

  it('redacts body matches via configured patterns', () => {
    const session = makeSession();
    const result = redactSession(session, {
      bodyPatterns: ['hunter2', /jwt-[a-z]+/],
    });

    expect(result.recordings[0].request.body).toBe(
      `{"password":"${REDACTED_PLACEHOLDER}"}`,
    );
    expect(result.recordings[0].response?.body).toBe(
      `{"token":"${REDACTED_PLACEHOLDER}"}`,
    );
  });

  it('exempts allow-listed headers from redaction', () => {
    const result = redactSession(makeSession(), {
      allowHeaders: ['set-cookie'],
    });
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

    const { request, response } = redactSession(session, {
      allowCookies: ['theme', 'ab_test'],
    }).recordings[0];

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
    const { request } = redactSession(makeSession(), {
      placeholder: '***',
    }).recordings[0];
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

    const ws = redactSession(session, { bodyPatterns: ['hunter2'] })
      .websocketRecordings[0];
    expect(ws.headers?.authorization).toBe(REDACTED_PLACEHOLDER);
    expect(ws.messages[0].data).toBe(`auth ${REDACTED_PLACEHOLDER}`);
  });
});
