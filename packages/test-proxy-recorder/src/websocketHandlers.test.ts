import { describe, expect, it } from 'vitest';

import { getBackendWsUrl } from './websocketHandlers.js';

describe('getBackendWsUrl', () => {
  it.each([
    ['http://localhost:9901', '/socket', 'ws://localhost:9901/socket'],
    [
      'http://localhost:9901/api/v1',
      '/socket',
      'ws://localhost:9901/api/v1/socket',
    ],
    [
      'http://localhost:9901/api/v1/',
      '/socket',
      'ws://localhost:9901/api/v1/socket',
    ],
    [
      'http://localhost:9901/api/v1//',
      '//socket',
      'ws://localhost:9901/api/v1/socket',
    ],
    [
      'https://example.test/api',
      '/socket?token=a//b',
      'wss://example.test/api/socket?token=a//b',
    ],
    ['http://localhost:9901', '/', 'ws://localhost:9901/'],
    ['ws://localhost:9901/api', '/socket', 'ws://localhost:9901/api/socket'],
    ['wss://example.test', '/socket', 'wss://example.test/socket'],
  ])('joins target %s and request %s into %s', (target, reqUrl, expected) => {
    expect(getBackendWsUrl(target, reqUrl)).toBe(expected);
  });
});
