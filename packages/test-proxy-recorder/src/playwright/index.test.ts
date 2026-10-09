import { Page } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaywrightTestInfo } from './index.js';
import {
  __resetProxyCachesForTests,
  generateSessionId,
  playwrightProxy,
} from './index.js';

// Mock the filesystem so HAR redaction can be observed without touching disk.
const { mockReadFile, mockWriteFile, mockReaddir, mockAccess } = vi.hoisted(
  () => ({
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockReaddir: vi.fn().mockResolvedValue([]),
    // No recording exists unless a test says otherwise.
    mockAccess: vi.fn().mockRejectedValue(new Error('ENOENT')),
  }),
);
vi.mock('node:fs', () => ({
  promises: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    readdir: mockReaddir,
    access: mockAccess,
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// Mock Page object
const createMockPage = () => {
  const eventHandlers = new Map<string, Function>();
  const contextEventHandlers = new Map<string, Function>();

  const mockContext = {
    addCookies: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: Function) => {
      contextEventHandlers.set(event, handler);
    }),
    _triggerEvent: (event: string) => {
      const handler = contextEventHandlers.get(event);
      if (handler) handler();
    },
  };

  return {
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    once: vi.fn(),
    route: vi.fn().mockResolvedValue(undefined),
    routeFromHAR: vi.fn().mockResolvedValue(undefined),
    context: vi.fn(() => mockContext),
    on: vi.fn((event: string, handler: Function) => {
      eventHandlers.set(event, handler);
    }),
    _triggerEvent: (event: string) => {
      const handler = eventHandlers.get(event);
      if (handler) handler();
    },
    _mockContext: mockContext,
  };
};

describe('Playwright Integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAccess.mockReset().mockRejectedValue(new Error('ENOENT'));
    __resetProxyCachesForTests();
    // Set default port via environment variable
    process.env.TEST_PROXY_RECORDER_PORT = '8100';
  });

  afterEach(() => {
    delete process.env.TEST_PROXY_RECORDER_PORT;
  });

  describe('replay of recordings named before describe titles counted', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'renders',
      titlePath: ['todos.spec.ts', 'alpha block', 'renders'],
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => ({ recordingsDir: '/rec' }),
      });
    });

    it('replays the old file name when only that recording exists', async () => {
      mockAccess.mockImplementation(async (file: string) => {
        if (file !== '/rec/todos__renders.mock.json') throw new Error('ENOENT');
      });
      const page = createMockPage();

      await playwrightProxy.before(page as unknown as Page, testInfo, 'replay');

      expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-test-rcrd-id': 'todos__renders',
      });
    });

    it('prefers the new file name once it is recorded', async () => {
      mockAccess.mockResolvedValue(undefined);
      const page = createMockPage();

      await playwrightProxy.before(page as unknown as Page, testInfo, 'replay');

      expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-test-rcrd-id': 'todos__alpha-block__renders',
      });
    });

    it('records under the new name even when an old recording exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      const page = createMockPage();

      await playwrightProxy.before(page as unknown as Page, testInfo, 'record');

      expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-test-rcrd-id': 'todos__alpha-block__renders',
      });
    });
  });

  describe('missing recordings in replay', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'loads',
      titlePath: ['home.spec.ts', 'loads'],
    };
    const isMissingRecordingPoll = (url: unknown) =>
      String(url).includes('/__control/missing-recording?id=home__loads');

    it('closes the page with the reason the proxy reports', async () => {
      const message = 'No recording for GET /api/todos (session: home__loads)';
      mockFetch.mockImplementation(async (url: unknown) =>
        isMissingRecordingPoll(url)
          ? { ok: true, status: 200, json: async () => ({ message }) }
          : { ok: true, status: 200, json: async () => ({ success: true }) },
      );
      const page = createMockPage();

      await playwrightProxy.before(page as unknown as Page, testInfo, 'replay');

      await vi.waitFor(() =>
        expect(page.close).toHaveBeenCalledWith({
          reason: expect.stringContaining(message),
        }),
      );
    });

    it('does not watch when failOnMissingRecording is false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      const page = createMockPage();

      await playwrightProxy.before(
        page as unknown as Page,
        testInfo,
        'replay',
        {
          failOnMissingRecording: false,
        },
      );

      const urls = mockFetch.mock.calls.map(([url]) => url);
      expect(urls.some((url) => isMissingRecordingPoll(url))).toBe(false);
    });

    it('does not watch while recording', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      const page = createMockPage();

      await playwrightProxy.before(page as unknown as Page, testInfo, 'record');

      const urls = mockFetch.mock.calls.map(([url]) => url);
      expect(urls.some((url) => isMissingRecordingPoll(url))).toBe(false);
    });
  });

  describe('playwrightProxy.before', () => {
    it('should call setProxyMode with correct mode and sessionId', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'test name',
        titlePath: ['Test.spec.ts', 'test name'],
      };

      await playwrightProxy.before(
        mockPage as unknown as Page,
        testInfo,
        'record',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'record',
            id: 'Test__test-name',
          }),
        },
      );
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-test-rcrd-id': 'Test__test-name',
      });
      expect(mockPage.route).toHaveBeenCalled();
      expect(mockPage.context).toHaveBeenCalled();
      expect(mockPage._mockContext.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );
    });

    it('should call setProxyMode with replay mode', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'replay test',
        titlePath: ['users/Auth.spec.ts', 'replay test'],
      };

      await playwrightProxy.before(
        mockPage as unknown as Page,
        testInfo,
        'replay',
      );

      // The mode switch, then the missing-recording long-poll.
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'replay',
            id: 'users/Auth__replay-test',
          }),
        },
      );
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'x-test-rcrd-id': 'users/Auth__replay-test',
      });
      expect(mockPage.route).toHaveBeenCalled();
      expect(mockPage.context).toHaveBeenCalled();
      expect(mockPage._mockContext.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );
    });

    it('should include timeout if provided', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'test with timeout',
        titlePath: [],
      };

      await playwrightProxy.before(
        mockPage as unknown as Page,
        testInfo,
        'record',
        30_000,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'record',
            id: 'test-with-timeout',
            timeout: 30_000,
          }),
        },
      );
    });

    it('should use custom port from environment variable', async () => {
      const mockPage = createMockPage();
      process.env.TEST_PROXY_RECORDER_PORT = '9999';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'custom port test',
        titlePath: [],
      };

      await playwrightProxy.before(
        mockPage as unknown as Page,
        testInfo,
        'record',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9999/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        },
      );
    });

    it('should throw error if proxy request fails', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Connection refused',
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'failing test',
        titlePath: [],
      };

      await expect(
        playwrightProxy.before(mockPage as unknown as Page, testInfo, 'record'),
      ).rejects.toThrow('Failed to set proxy mode');
    });

    it('should throw error if fetch throws', async () => {
      const mockPage = createMockPage();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const testInfo: PlaywrightTestInfo = {
        title: 'network error test',
        titlePath: [],
      };

      await expect(
        playwrightProxy.before(mockPage as unknown as Page, testInfo, 'record'),
      ).rejects.toThrow('Network error');
    });

    it('should cleanup and switch to transparent mode when context closes', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'cleanup test',
        titlePath: [],
      };

      await playwrightProxy.before(
        mockPage as unknown as Page,
        testInfo,
        'record',
      );

      // Verify context handler was registered
      expect(mockPage._mockContext.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );

      // Reset fetch mock to track cleanup call
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Trigger context close event
      mockPage._mockContext._triggerEvent('close');

      // Wait for async cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify cleanup was called for the specific session
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cleanup: true,
            id: 'cleanup-test',
          }),
        },
      );
    });

    it('does not redact HAR on context close (handler only cleans up)', async () => {
      const mockPage = createMockPage();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      mockReadFile.mockReset();
      mockWriteFile.mockReset().mockResolvedValue(undefined);

      await playwrightProxy.before(
        mockPage as unknown as Page,
        { title: 'on close', titlePath: ['Har.spec.ts', 'on close'] },
        'record',
        { url: /api\.example\.com/ },
      );

      mockPage._mockContext._triggerEvent('close');
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Redaction moved to teardown — the close handler must not touch files
      // (doing so races the process exit and can truncate the HAR).
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('playwrightProxy.teardown', () => {
    beforeEach(() => {
      // teardown reads cached /__control lookups; start each test fresh.
      __resetProxyCachesForTests();
      mockReadFile.mockReset();
      mockWriteFile.mockReset().mockResolvedValue(undefined);
      mockReaddir.mockReset().mockResolvedValue([]);
    });

    it('should switch to transparent mode without sessionId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await playwrightProxy.teardown();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'transparent',
          }),
        },
      );
    });

    it('redacts each .har in the recordings dir, skipping unchanged files', async () => {
      mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
        if (!options || options.method === undefined) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              recordingsDir: '/recordings',
              redaction: { headers: ['x-api-key'] },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      });
      mockReaddir.mockResolvedValue(['secret.har', 'todos.har', 'notes.txt']);
      mockReadFile.mockImplementation((file: string) => {
        if (file.endsWith('secret.har')) {
          return Promise.resolve(
            JSON.stringify({
              log: {
                entries: [
                  {
                    request: {
                      headers: [
                        { name: 'authorization', value: 'Bearer leaked' },
                        { name: 'x-api-key', value: 'key-leaked' },
                      ],
                    },
                    response: { headers: [] },
                  },
                ],
              },
            }),
          );
        }
        // No secrets — nothing to redact.
        return Promise.resolve(
          JSON.stringify({
            log: {
              entries: [
                { request: { headers: [{ name: 'accept', value: '*/*' }] } },
              ],
            },
          }),
        );
      });

      await playwrightProxy.teardown();

      // Only the file that actually changed is rewritten; the clean one and the
      // non-.har file are left untouched.
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [writtenPath, written] = mockWriteFile.mock.calls[0];
      expect(writtenPath).toBe('/recordings/secret.har');
      const headers = JSON.parse(written as string).log.entries[0].request
        .headers as { name: string; value: string }[];
      expect(headers.find((h) => h.name === 'authorization')!.value).toBe(
        '[REDACTED]',
      );
      expect(headers.find((h) => h.name === 'x-api-key')!.value).toBe(
        '[REDACTED]',
      );
    });

    it('does not redact when redaction is disabled (wire `false`)', async () => {
      mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
        if (!options || options.method === undefined) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              recordingsDir: '/recordings',
              redaction: false,
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      });
      mockReaddir.mockResolvedValue(['secret.har']);

      await playwrightProxy.teardown();

      expect(mockReaddir).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('does not redact when no redaction config is set (opt-in default)', async () => {
      // GET returns recordingsDir but no `redaction` — the off-by-default case.
      mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
        if (!options || options.method === undefined) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ recordingsDir: '/recordings' }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      });
      mockReaddir.mockResolvedValue(['secret.har']);

      await playwrightProxy.teardown();

      expect(mockReaddir).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should use custom port in teardown', async () => {
      process.env.TEST_PROXY_RECORDER_PORT = '7777';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await playwrightProxy.teardown();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:7777/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'transparent',
          }),
        },
      );
    });

    it('should throw error if teardown fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Teardown failed',
      });

      await expect(playwrightProxy.teardown()).rejects.toThrow(
        'Failed to set proxy mode',
      );
    });

    it('should throw error if fetch throws during teardown', async () => {
      mockFetch.mockRejectedValue(new Error('Connection error'));

      await expect(playwrightProxy.teardown()).rejects.toThrow(
        'Connection error',
      );
    });
  });
});

describe('generateSessionId', () => {
  it('should generate session ID from title when titlePath is not provided', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'create a job',
      titlePath: [],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('create-a-job');
  });

  it('should generate session ID with folder structure from titlePath', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'create a job',
      titlePath: ['jobs/Create.spec.ts', 'create a job'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('jobs/Create__create-a-job');
  });

  it('should handle titlePath without folder (file at root)', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'simple test',
      titlePath: ['Simple.spec.ts', 'simple test'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('Simple__simple-test');
  });

  it('should handle titlePath with nested folders', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'update user profile',
      titlePath: ['users/profile/Update.spec.ts', 'update user profile'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('users/profile/Update__update-user-profile');
  });

  it('should normalize test names with spaces to hyphens', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'should create a new job with multiple spaces',
      titlePath: [
        'jobs/Create.spec.ts',
        'should create a new job with multiple spaces',
      ],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe(
      'jobs/Create__should-create-a-new-job-with-multiple-spaces',
    );
  });

  it('should handle titlePath with only test name (no spec file)', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'test without file',
      titlePath: ['test without file'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('test-without-file');
  });

  it('should handle empty titlePath array by falling back to title', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'fallback test',
      titlePath: [],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('fallback-test');
  });

  it('should preserve case in file names but lowercase test names', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'Create New Item',
      titlePath: ['inventory/CreateItem.spec.ts', 'Create New Item'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('inventory/CreateItem__create-new-item');
  });

  it('should handle .test.ts extension', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'test with test extension',
      titlePath: ['users/Auth.test.ts', 'test with test extension'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('users/Auth__test-with-test-extension');
  });

  it('should handle .test.ts extension without folder', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'simple test',
      titlePath: ['Simple.test.ts', 'simple test'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('Simple__simple-test');
  });

  it('includes describe titles so equal test titles in one file get separate recordings', () => {
    const inAlpha = generateSessionId({
      title: 'renders',
      titlePath: ['todos.spec.ts', 'alpha block', 'renders'],
    });
    const inBravo = generateSessionId({
      title: 'renders',
      titlePath: ['todos.spec.ts', 'bravo block', 'renders'],
    });

    expect(inAlpha).toBe('todos__alpha-block__renders');
    expect(inBravo).toBe('todos__bravo-block__renders');
  });

  it('prefixes the file name for any JS or TS test file', () => {
    const name = (file: string) =>
      generateSessionId({ title: 'logs in', titlePath: [file, 'logs in'] });

    expect(name('app/Login.spec.tsx')).toBe('app/Login__logs-in');
    expect(name('smoke.e2e.ts')).toBe('smoke.e2e__logs-in');
    expect(name('Login.test.mjs')).toBe('Login__logs-in');
    expect(name(String.raw`jobs\Create.spec.ts`)).toBe('jobs/Create__logs-in');
  });

  it('should handle nested folders with .test.ts extension', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'complex integration test',
      titlePath: ['integration/api/Users.test.ts', 'complex integration test'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('integration/api/Users__complex-integration-test');
  });
});
