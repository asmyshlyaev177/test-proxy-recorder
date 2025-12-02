import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaywrightTestInfo } from './index.js';
import { generateSessionId, playwrightProxy } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('Playwright Integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Set default port via environment variable
    process.env.TEST_PROXY_RECORDER_PORT = '8100';
  });

  afterEach(() => {
    delete process.env.TEST_PROXY_RECORDER_PORT;
  });

  describe('playwrightProxy.before', () => {
    it('should call setProxyMode with correct mode and sessionId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'test name',
        titlePath: ['Test.spec.ts', 'test name'],
      };

      await playwrightProxy.before(testInfo, 'record');

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
    });

    it('should call setProxyMode with replay mode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'replay test',
        titlePath: ['users/Auth.spec.ts', 'replay test'],
      };

      await playwrightProxy.before(testInfo, 'replay');

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
    });

    it('should include timeout if provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'test with timeout',
        titlePath: [],
      };

      await playwrightProxy.before(testInfo, 'record', 30_000);

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
      process.env.TEST_PROXY_RECORDER_PORT = '9999';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'custom port test',
        titlePath: [],
      };

      await playwrightProxy.before(testInfo, 'record');

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
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Connection refused',
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'failing test',
        titlePath: [],
      };

      await expect(playwrightProxy.before(testInfo, 'record')).rejects.toThrow(
        'Failed to set proxy mode',
      );
    });

    it('should throw error if fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const testInfo: PlaywrightTestInfo = {
        title: 'network error test',
        titlePath: [],
      };

      await expect(playwrightProxy.before(testInfo, 'record')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('playwrightProxy.after', () => {
    it('should reset session by re-entering replay mode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'cleanup test',
        titlePath: ['Cleanup.spec.ts', 'cleanup test'],
      };

      await playwrightProxy.after(testInfo);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Should switch to replay mode, which automatically resets session counters
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'replay',
            id: 'Cleanup__cleanup-test',
          }),
        },
      );
    });

    it('should throw error if cleanup fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => 'Cleanup failed',
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'error test',
        titlePath: [],
      };

      await expect(playwrightProxy.after(testInfo)).rejects.toThrow(
        'Failed to set proxy mode',
      );
    });

    it('should throw error if fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const testInfo: PlaywrightTestInfo = {
        title: 'network error test',
        titlePath: [],
      };

      await expect(playwrightProxy.after(testInfo)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle nested folder structure in after', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testInfo: PlaywrightTestInfo = {
        title: 'nested test',
        titlePath: ['api/v1/Users.spec.ts', 'nested test'],
      };

      await playwrightProxy.after(testInfo);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify sessionId includes folder structure
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8100/__control',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'replay',
            id: 'api/v1/Users__nested-test',
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
