import { Page } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaywrightTestInfo } from './index.js';
import { generateSessionId, playwrightProxy } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// Mock Page object
const createMockPage = () => {
  const eventHandlers = new Map<string, Function>();
  const contextEventHandlers = new Map<string, Function>();

  const mockContext = {
    on: vi.fn((event: string, handler: Function) => {
      contextEventHandlers.set(event, handler);
    }),
    _guid: 'test-context-guid',
    _triggerEvent: (event: string) => {
      const handler = contextEventHandlers.get(event);
      if (handler) handler();
    },
  };

  return {
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
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
    // Set default port via environment variable
    process.env.TEST_PROXY_RECORDER_PORT = '8100';
    // Clear global handler registrations
    Object.keys(global).forEach((key) => {
      if (key.startsWith('cleanup_')) {
        delete (global as any)[key];
      }
    });
  });

  afterEach(() => {
    delete process.env.TEST_PROXY_RECORDER_PORT;
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
        'http://127.0.0.1:8100/__control',
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
      expect(mockPage._mockContext.on).toHaveBeenCalledWith('close', expect.any(Function));
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

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8100/__control',
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
      expect(mockPage._mockContext.on).toHaveBeenCalledWith('close', expect.any(Function));
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
        'http://127.0.0.1:8100/__control',
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
        'http://127.0.0.1:9999/__control',
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
      expect(mockPage._mockContext.on).toHaveBeenCalledWith('close', expect.any(Function));

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
        'http://127.0.0.1:8100/__control',
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
  });

  describe('playwrightProxy.teardown', () => {
    it('should switch to transparent mode without sessionId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await playwrightProxy.teardown();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'transparent',
          }),
        },
      );
    });

    it('should use custom port in teardown', async () => {
      process.env.TEST_PROXY_RECORDER_PORT = '7777';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await playwrightProxy.teardown();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:7777/__control',
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

  it('should handle nested folders with .test.ts extension', () => {
    const testInfo: PlaywrightTestInfo = {
      title: 'complex integration test',
      titlePath: ['integration/api/Users.test.ts', 'complex integration test'],
    };

    const sessionId = generateSessionId(testInfo);
    expect(sessionId).toBe('integration/api/Users__complex-integration-test');
  });
});
