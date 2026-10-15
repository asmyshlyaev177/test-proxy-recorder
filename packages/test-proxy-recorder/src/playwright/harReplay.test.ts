import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Route } from '@playwright/test';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import type { HarEntry, HarNameValue } from '../utils/redact.js';
import {
  createHarReplayHandler,
  HarReplaySequence,
  loadHarEntries,
  type ReplayRequest,
} from './harReplay.js';

const ORIGIN = 'https://api.test';
const TODOS = `${ORIGIN}/todos`;

interface EntryOptions {
  postData?: string;
  requestHeaders?: HarNameValue[];
  status?: number;
  responseHeaders?: HarNameValue[];
}

function entry(
  method: string,
  url: string,
  body: string,
  options: EntryOptions = {},
): HarEntry {
  return {
    request: {
      method,
      url,
      headers: options.requestHeaders ?? [],
      ...(options.postData === undefined
        ? {}
        : { postData: { text: options.postData } }),
    },
    response: {
      status: options.status ?? 200,
      headers: options.responseHeaders ?? [
        { name: 'content-type', value: 'application/json' },
      ],
      content: { text: body },
    },
  };
}

const read = (body: string, url = TODOS) => entry('GET', url, body);
const write = (text: string, url = TODOS) =>
  entry('POST', url, `["${text}"]`, { postData: `{"text":"${text}"}` });
const request = (
  method: string,
  url = TODOS,
  body = '',
  headers: HarNameValue[] = [],
): ReplayRequest => ({ method, url, body, headers });
const bodyOf = (served: HarEntry | undefined) =>
  served?.response?.content?.text;

describe('HarReplaySequence', () => {
  it('serves repeats of a request in recorded order', () => {
    const sequence = new HarReplaySequence([read('1'), read('2'), read('3')]);

    const bodies = [1, 2, 3].map(() => bodyOf(sequence.next(request('GET'))));

    expect(bodies).toEqual(['1', '2', '3']);
  });

  it('serves the read after a write the state the write produced', () => {
    // GET, POST, GET on one URL: the scenario in microsoft/playwright#32272.
    const sequence = new HarReplaySequence([
      read('[]'),
      write('milk'),
      read('["milk"]'),
    ]);

    expect(bodyOf(sequence.next(request('GET')))).toBe('[]');
    expect(
      bodyOf(sequence.next(request('POST', TODOS, '{"text":"milk"}'))),
    ).toBe('["milk"]');
    expect(bodyOf(sequence.next(request('GET')))).toBe('["milk"]');
  });

  it('drops pre-write copies the replay never asked for once the write is served', () => {
    // Recorded with two reads before the write (a strict-mode double fetch), replayed with one.
    const sequence = new HarReplaySequence([
      read('[]'),
      read('[]'),
      write('milk'),
      read('["milk"]'),
    ]);

    sequence.next(request('GET'));
    sequence.next(request('POST', TODOS, '{"text":"milk"}'));

    expect(bodyOf(sequence.next(request('GET')))).toBe('["milk"]');
  });

  it('reuses the latest pre-write copy when the replay reads more often before the write', () => {
    const sequence = new HarReplaySequence([
      read('[]'),
      write('milk'),
      read('["milk"]'),
    ]);

    expect(bodyOf(sequence.next(request('GET')))).toBe('[]');
    expect(bodyOf(sequence.next(request('GET')))).toBe('[]');
    sequence.next(request('POST', TODOS, '{"text":"milk"}'));
    expect(bodyOf(sequence.next(request('GET')))).toBe('["milk"]');
  });

  it('retires the copies recorded before a write to a path under the read', () => {
    const sequence = new HarReplaySequence([
      read('[]'),
      read('[]'),
      entry('PUT', `${TODOS}/1`, '{}', { postData: '{"done":true}' }),
      read('["done"]'),
    ]);

    sequence.next(request('GET'));
    sequence.next(request('PUT', `${TODOS}/1`, '{"done":true}'));

    expect(bodyOf(sequence.next(request('GET')))).toBe('["done"]');
  });

  it('lets a write to an unrelated path neither block nor retire reads', () => {
    // Telemetry the replay never sends must not freeze a poll on "pending".
    const status = `${ORIGIN}/status`;
    const sequence = new HarReplaySequence([
      read('pending', status),
      entry('POST', `${ORIGIN}/log`, '{}', { postData: '{"at":1}' }),
      read('done', status),
    ]);

    expect(bodyOf(sequence.next(request('GET', status)))).toBe('pending');
    expect(bodyOf(sequence.next(request('GET', status)))).toBe('done');
  });

  it('reuses the last copy once every copy is served', () => {
    const sequence = new HarReplaySequence([read('1'), read('2')]);
    sequence.next(request('GET'));
    sequence.next(request('GET'));

    expect(bodyOf(sequence.next(request('GET')))).toBe('2');
  });

  it('serves a write recorded ahead of the reads when the replay writes first', () => {
    const sequence = new HarReplaySequence([write('milk'), read('["milk"]')]);

    expect(
      bodyOf(sequence.next(request('POST', TODOS, '{"text":"milk"}'))),
    ).toBe('["milk"]');
    expect(bodyOf(sequence.next(request('GET')))).toBe('["milk"]');
  });

  it('serves reads recorded after a write the replay has not reached, in order', () => {
    const sequence = new HarReplaySequence([
      write('milk'),
      read('a'),
      read('b'),
    ]);

    expect(bodyOf(sequence.next(request('GET')))).toBe('a');
    expect(bodyOf(sequence.next(request('GET')))).toBe('b');
  });

  it('tells bodies apart for every method, not only POST', () => {
    const sequence = new HarReplaySequence([
      entry('PUT', TODOS, 'a', { postData: '{"text":"a"}' }),
      entry('PUT', TODOS, 'b', { postData: '{"text":"b"}' }),
    ]);

    expect(bodyOf(sequence.next(request('PUT', TODOS, '{"text":"b"}')))).toBe(
      'b',
    );
  });

  it('matches by method and URL when no entry has the request body', () => {
    // A timestamp or client-made id in the body differs on every run.
    const sequence = new HarReplaySequence([
      entry('PUT', TODOS, 'saved', { postData: '{"at":1}' }),
    ]);

    expect(bodyOf(sequence.next(request('PUT', TODOS, '{"at":2}')))).toBe(
      'saved',
    );
  });

  it('prefers the entries sharing the most request headers', () => {
    // AWS JSON-RPC: every Cognito call is POST / and only X-Amz-Target names the operation.
    const target = (name: string) => [{ name: 'x-amz-target', value: name }];
    const sequence = new HarReplaySequence([
      entry('POST', ORIGIN, '{"user":1}', {
        postData: '{"t":1}',
        requestHeaders: target('GetUser'),
      }),
      entry('POST', ORIGIN, '{}', {
        postData: '{"t":1}',
        requestHeaders: target('GlobalSignOut'),
      }),
    ]);
    const call = (name: string) =>
      bodyOf(sequence.next(request('POST', ORIGIN, '{"t":1}', target(name))));

    expect(call('GetUser')).toBe('{"user":1}');
    expect(call('GetUser')).toBe('{"user":1}');
    expect(call('GlobalSignOut')).toBe('{}');
  });

  it('returns nothing for a request that was never recorded', () => {
    const sequence = new HarReplaySequence([read('1')]);

    expect(sequence.next(request('DELETE'))).toBeUndefined();
  });

  it('replaying the recorded request sequence yields the recorded entries in order', () => {
    const arbitraryEntry = fc
      .record({
        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        url: fc.constantFrom(`${ORIGIN}/x`, `${ORIGIN}/x/1`, `${ORIGIN}/y`),
        body: fc.string({ maxLength: 2 }),
      })
      .map(({ method, url, body }) =>
        entry(method, url, body, { postData: body }),
      );

    fc.assert(
      fc.property(fc.array(arbitraryEntry, { maxLength: 25 }), (entries) => {
        const sequence = new HarReplaySequence(entries);
        for (const recorded of entries) {
          const { method, url, postData } = recorded.request!;
          const served = sequence.next(request(method!, url, postData?.text));
          expect(served).toBe(recorded);
        }
      }),
    );
  });
});

describe('createHarReplayHandler', () => {
  function fakeRoute(
    method: string,
    url: string,
    options: { postData?: string | null; isNavigation?: boolean } = {},
  ) {
    return {
      request: () => ({
        method: () => method,
        url: () => url,
        postData: () => options.postData ?? null,
        headers: () => ({}),
        isNavigationRequest: () => options.isNavigation ?? false,
      }),
      fulfill: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };
  }
  const asRoute = (route: ReturnType<typeof fakeRoute>) =>
    route as unknown as Route;
  const redirect = (from: string, to: string, status = 302) =>
    entry('GET', from, '', {
      status,
      responseHeaders: [{ name: 'location', value: to }],
    });

  it('fulfills with the recorded status, headers and body', async () => {
    const route = fakeRoute('GET', TODOS);

    await createHarReplayHandler([read('[]')])(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('[]'),
    });
  });

  it('ignores the multipart boundary, which the browser picks per request', async () => {
    const multipart = (boundary: string) => ({
      headers: [
        {
          name: 'content-type',
          value: `multipart/form-data; boundary=${boundary}`,
        },
      ],
      body: `--${boundary}\r\nContent-Disposition: form-data; name="f"\r\n\r\nhi\r\n--${boundary}--`,
    });
    const recorded = entry('POST', TODOS, 'uploaded', {
      postData: multipart('aaa').body,
      requestHeaders: multipart('aaa').headers,
    });
    const route = fakeRoute('POST', TODOS, { postData: multipart('bbb').body });
    route.request = () => ({
      method: () => 'POST',
      url: () => TODOS,
      postData: () => multipart('bbb').body,
      headers: () => ({ 'content-type': multipart('bbb').headers[0].value }),
      isNavigationRequest: () => false,
    });

    await createHarReplayHandler([recorded])(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ body: Buffer.from('uploaded') }),
    );
  });

  it('folds repeated Set-Cookie headers into one and decodes base64 bodies', async () => {
    const recorded: HarEntry = {
      request: { method: 'GET', url: TODOS, headers: [] },
      response: {
        status: 201,
        headers: [
          { name: 'Set-Cookie', value: 'a=1' },
          { name: 'Set-Cookie', value: 'b=2' },
        ],
        content: {
          text: Buffer.from('bytes').toString('base64'),
          encoding: 'base64',
        },
      },
    };
    const route = fakeRoute('GET', TODOS);

    await createHarReplayHandler([recorded])(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith({
      status: 201,
      headers: { 'set-cookie': 'a=1\nb=2' },
      body: Buffer.from('bytes'),
    });
  });

  it('follows a recorded redirect inside the HAR for a fetch', async () => {
    // The browser's follow-up request never reaches page.route, so the final response is served here.
    const handler = createHarReplayHandler([
      redirect(`${TODOS}/`, '/todos', 307),
      read('[]'),
    ]);
    const route = fakeRoute('GET', `${TODOS}/`);

    await handler(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200, body: Buffer.from('[]') }),
    );
  });

  it('sends a navigation recorded as a redirect on to its target', async () => {
    const handler = createHarReplayHandler([
      redirect(`${ORIGIN}/old`, '/'),
      entry('GET', `${ORIGIN}/`, '<html>home</html>'),
    ]);
    const route = fakeRoute('GET', `${ORIGIN}/old`, { isNavigation: true });

    await handler(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith({
      status: 200,
      contentType: 'text/html',
      body: expect.stringContaining(`url=${ORIGIN}/`),
    });
  });

  it('serves a redirect with an unparseable Location as recorded', async () => {
    const route = fakeRoute('GET', `${ORIGIN}/a`);

    await createHarReplayHandler([redirect(`${ORIGIN}/a`, 'http://')])(
      asRoute(route),
    );

    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 302,
        headers: { location: 'http://' },
      }),
    );
  });

  it('aborts a redirect chain that loops', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createHarReplayHandler([
      redirect(`${ORIGIN}/a`, '/b'),
      redirect(`${ORIGIN}/b`, '/a'),
    ]);
    const route = fakeRoute('GET', `${ORIGIN}/a`);

    await handler(asRoute(route));

    expect(route.abort).toHaveBeenCalled();
    error.mockRestore();
  });

  it('aborts a request with no recording', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const route = fakeRoute('DELETE', TODOS);

    await createHarReplayHandler([read('[]')])(asRoute(route));

    expect(route.abort).toHaveBeenCalled();
    expect(route.fulfill).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(`No recorded response for DELETE ${TODOS}`),
    );
    error.mockRestore();
  });

  it('serves a body kept in a sidecar file by a HAR recorded with `attach`', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tpr-sidecar-'));
    const recorded = read('');
    recorded.response!.content = {
      _file: 'body.bin',
      mimeType: 'application/json',
    };
    await fs.writeFile(path.join(dir, 'body.bin'), '["from file"]');
    await fs.writeFile(
      path.join(dir, 'test.har'),
      JSON.stringify({ log: { entries: [recorded] } }),
    );
    const route = fakeRoute('GET', TODOS);

    const entries = await loadHarEntries(path.join(dir, 'test.har'));
    await createHarReplayHandler(entries)(asRoute(route));

    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ body: Buffer.from('["from file"]') }),
    );
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('fails again a request that failed while recording', async () => {
    const failed: HarEntry = {
      request: { method: 'GET', url: TODOS, headers: [] },
      response: { status: -1, headers: [], content: {} },
    };
    const route = fakeRoute('GET', TODOS);

    await createHarReplayHandler([failed])(asRoute(route));

    expect(route.abort).toHaveBeenCalled();
    expect(route.fulfill).not.toHaveBeenCalled();
  });
});
