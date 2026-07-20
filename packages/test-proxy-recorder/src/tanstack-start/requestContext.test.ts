import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stand in for `@tanstack/react-start/server` (not a dependency of this package).
// The mutable state lets each test control what the "current request" exposes,
// including throwing — how the server helpers behave outside a request scope.
const mockState = vi.hoisted(() => ({
  headerValue: null as string | null,
  shouldThrow: false,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: (name: string) => {
    if (mockState.shouldThrow) {
      throw new Error('getRequestHeader called outside a request scope');
    }
    return name === 'x-test-rcrd-id'
      ? (mockState.headerValue ?? undefined)
      : undefined;
  },
}));

import {
  createHeadersWithRecordingId,
  getRecordingId,
} from './requestContext.js';

const HEADER = 'x-test-rcrd-id';

describe('tanstack-start requestContext helpers', () => {
  let nodeEnvBackup: string | undefined;
  let enabledBackup: string | undefined;

  beforeEach(() => {
    mockState.headerValue = null;
    mockState.shouldThrow = false;

    nodeEnvBackup = process.env.NODE_ENV;
    enabledBackup = process.env.TEST_PROXY_RECORDER_ENABLED;
    process.env.NODE_ENV = 'test';
    delete process.env.TEST_PROXY_RECORDER_ENABLED;
  });

  afterEach(() => {
    restoreEnv('NODE_ENV', nodeEnvBackup);
    restoreEnv('TEST_PROXY_RECORDER_ENABLED', enabledBackup);
    vi.clearAllMocks();
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  describe('getRecordingId', () => {
    it('returns the current request id when the recorder is enabled', async () => {
      mockState.headerValue = 'session-alpha';

      await expect(getRecordingId()).resolves.toBe('session-alpha');
    });

    it('returns null outside a request scope (getRequestHeader throws)', async () => {
      mockState.shouldThrow = true;

      await expect(getRecordingId()).resolves.toBeNull();
    });

    it('returns null when the header is absent', async () => {
      mockState.headerValue = null;

      await expect(getRecordingId()).resolves.toBeNull();
    });

    it('no-ops (returns null) in production without the enable flag', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TEST_PROXY_RECORDER_ENABLED;
      mockState.headerValue = 'should-not-leak';

      await expect(getRecordingId()).resolves.toBeNull();
    });

    it('reads the id in production when TEST_PROXY_RECORDER_ENABLED is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_PROXY_RECORDER_ENABLED = 'true';
      mockState.headerValue = 'session-prod';

      await expect(getRecordingId()).resolves.toBe('session-prod');
    });
  });

  describe('createHeadersWithRecordingId', () => {
    it('merges the recording id with the supplied headers', async () => {
      mockState.headerValue = 'session-merge';

      await expect(
        createHeadersWithRecordingId({ 'content-type': 'application/json' }),
      ).resolves.toEqual({
        'content-type': 'application/json',
        [HEADER]: 'session-merge',
      });
    });

    it('defaults to just the recording id when no headers are passed', async () => {
      mockState.headerValue = 'session-only';

      await expect(createHeadersWithRecordingId()).resolves.toEqual({
        [HEADER]: 'session-only',
      });
    });

    it('returns the supplied headers unchanged when no id is available', async () => {
      mockState.shouldThrow = true;

      await expect(
        createHeadersWithRecordingId({ 'content-type': 'application/json' }),
      ).resolves.toEqual({ 'content-type': 'application/json' });
    });

    it('no-ops in production without the enable flag (no id added)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TEST_PROXY_RECORDER_ENABLED;
      mockState.headerValue = 'should-not-leak';

      await expect(
        createHeadersWithRecordingId({ 'content-type': 'application/json' }),
      ).resolves.toEqual({ 'content-type': 'application/json' });
    });
  });
});
