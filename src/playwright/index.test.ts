import { describe, expect, it } from 'vitest';

import type { PlaywrightTestInfo } from './index.js';
import { generateSessionId } from './index.js';

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
