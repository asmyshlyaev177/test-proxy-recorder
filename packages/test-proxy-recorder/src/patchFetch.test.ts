import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patchGlobalFetch } from './patchFetch.js';

const HEADER = 'x-test-rcrd-id';

describe('patchGlobalFetch', () => {
  let realFetch: typeof globalThis.fetch;
  let original: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    original = vi.fn(async () => new Response('ok'));
    globalThis.fetch = original as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.clearAllMocks();
  });

  function forwardedHeaders(callIndex = 0): Headers {
    const init = original.mock.calls[callIndex]?.[1] as RequestInit | undefined;
    return new Headers(init?.headers ?? {});
  }

  const resolves = (id: string | null) => vi.fn(async () => id);

  it('tags an outgoing request with the resolved id', async () => {
    patchGlobalFetch(resolves('session-alpha'));

    await globalThis.fetch('http://localhost:8110/todos');

    expect(original).toHaveBeenCalledTimes(1);
    expect(original.mock.calls[0][0]).toBe('http://localhost:8110/todos');
    expect(forwardedHeaders().get(HEADER)).toBe('session-alpha');
  });

  it('preserves method, body, and existing headers', async () => {
    patchGlobalFetch(resolves('session-x'));

    await globalThis.fetch('http://localhost:8110/todos', {
      method: 'POST',
      body: '{"text":"buy milk"}',
      headers: { 'content-type': 'application/json' },
    });

    const init = original.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"text":"buy milk"}');
    const headers = forwardedHeaders();
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get(HEADER)).toBe('session-x');
  });

  it('copies headers from a Request input and adds the id', async () => {
    patchGlobalFetch(resolves('session-req'));

    await globalThis.fetch(
      new Request('http://localhost:8110/todos', {
        headers: { 'x-custom': 'kept' },
      }),
    );

    const headers = forwardedHeaders();
    expect(headers.get('x-custom')).toBe('kept');
    expect(headers.get(HEADER)).toBe('session-req');
  });

  it('does not overwrite an id the caller already set', async () => {
    patchGlobalFetch(resolves('auto-id'));

    await globalThis.fetch('http://localhost:8110/todos', {
      headers: { [HEADER]: 'explicit-id' },
    });

    expect(forwardedHeaders().get(HEADER)).toBe('explicit-id');
  });

  it('leaves the request untouched when no id is resolved', async () => {
    patchGlobalFetch(resolves(null));

    await globalThis.fetch('http://localhost:8110/todos', {
      headers: { 'content-type': 'application/json' },
    });

    const headers = forwardedHeaders();
    expect(headers.has(HEADER)).toBe(false);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('returns the response from the underlying fetch', async () => {
    const response = new Response('payload', { status: 201 });
    original.mockResolvedValueOnce(response);
    patchGlobalFetch(resolves('session-x'));

    const result = await globalThis.fetch('http://localhost:8110/todos');

    expect(result).toBe(response);
  });

  it('is idempotent — patching twice does not double-wrap', async () => {
    patchGlobalFetch(resolves('session-x'));
    const wrapper = globalThis.fetch;

    patchGlobalFetch(resolves('other'));

    expect(globalThis.fetch).toBe(wrapper);
    await globalThis.fetch('http://localhost:8110/todos');
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no global fetch to patch', () => {
    globalThis.fetch = undefined as unknown as typeof globalThis.fetch;
    expect(() => patchGlobalFetch(resolves('x'))).not.toThrow();
    expect(globalThis.fetch).toBeUndefined();
  });

  describe('fails safe — never breaks the app fetch', () => {
    it('falls through untouched when the resolver throws', async () => {
      const resolver = vi.fn(async () => {
        throw new Error('request context blew up');
      });
      patchGlobalFetch(resolver);

      const res = await globalThis.fetch('http://localhost:8110/todos', {
        headers: { 'content-type': 'application/json' },
      });

      // The app's request still went through, untagged.
      expect(res).toBeInstanceOf(Response);
      expect(original).toHaveBeenCalledTimes(1);
      const headers = forwardedHeaders();
      expect(headers.has(HEADER)).toBe(false);
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('falls through untouched when the resolver rejects', async () => {
      patchGlobalFetch(vi.fn(() => Promise.reject(new Error('nope'))));

      await expect(
        globalThis.fetch('http://localhost:8110/todos'),
      ).resolves.toBeInstanceOf(Response);
      expect(original).toHaveBeenCalledTimes(1);
      expect(forwardedHeaders().has(HEADER)).toBe(false);
    });

    it('sends the original request when header construction throws', async () => {
      patchGlobalFetch(resolves('session-x'));

      // A Headers-like init that throws when copied — stands in for any exotic
      // caller value that breaks header construction.
      const hostileInit = {
        get headers() {
          throw new Error('cannot read headers');
        },
      } as RequestInit;

      const res = await globalThis.fetch(
        'http://localhost:8110/todos',
        hostileInit,
      );

      expect(res).toBeInstanceOf(Response);
      expect(original).toHaveBeenCalledTimes(1);
      // Fell back to the caller's exact arguments.
      expect(original.mock.calls[0][1]).toBe(hostileInit);
    });
  });
});
