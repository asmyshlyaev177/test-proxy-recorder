import type { TestInfo } from '@playwright/test';

import { type Mode, Modes } from '../types';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || 'http://localhost:8100';

export type PlaywrightTestInfo = Pick<TestInfo, 'title' | 'titlePath'>;

interface ProxyControlRequest {
  mode: Mode;
  id?: string;
  timeout?: number;
}

/**
 * Set the proxy mode for a given session
 * @param mode - The proxy mode to set (recording, replay, transparent)
 * @param sessionId - Unique identifier for the session
 * @param timeout - Optional timeout in milliseconds
 */
export async function setProxyMode(
  mode: Mode,
  sessionId?: string,
  timeout?: number,
): Promise<void> {
  if (!INTERNAL_API_URL) {
    console.warn('INTERNAL_API_URL not set, proxy mode not changed');
    return;
  }

  try {
    const body: ProxyControlRequest = {
      mode,
      id: sessionId,
      ...(timeout && { timeout }),
    };

    const response = await fetch(`${INTERNAL_API_URL}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to set proxy mode to ${mode}:`, text);
      throw new Error(`Failed to set proxy mode: ${text}`);
    }

    await response.json();
    console.log(`Proxy mode set to: ${mode} (session: ${sessionId})`);
  } catch (error) {
    console.error(`Error setting proxy mode:`, error);
    throw error;
  }
}

interface ParsedPath {
  folder: string | null;
  fileName: string | null;
}

function parseSpecFilePath(specPath: string): ParsedPath {
  // Try to match 'folder/FileName.(spec|test).ts' pattern
  const folderMatch = specPath.match(/^(.+?)\/([^/]+)\.(spec|test)\.ts$/);
  if (folderMatch) {
    return { folder: folderMatch[1], fileName: folderMatch[2] };
  }

  // Try to match 'FileName.(spec|test).ts' pattern (no folder)
  const fileMatch = specPath.match(/^([^/]+)\.(spec|test)\.ts$/);
  if (fileMatch) {
    return { folder: null, fileName: fileMatch[1] };
  }

  return { folder: null, fileName: null };
}

function buildSessionPath(
  folder: string | null,
  fileName: string | null,
  testName: string,
): string {
  if (folder && fileName) {
    return `${folder}/${fileName}__${testName}`;
  }
  if (fileName) {
    return `${fileName}__${testName}`;
  }
  return testName;
}

/**
 * Generate a session ID from test info
 * Uses titlePath to create folder structure with test file name
 * Supports both .spec.ts and .test.ts extensions
 * Example: ['jobs/Create.spec.ts', 'create a job'] becomes 'jobs/Create__create-a-job'
 * Example: ['users/Auth.test.ts', 'login test'] becomes 'users/Auth__login-test'
 * @param testInfo - Playwright test info object
 */
export function generateSessionId(testInfo: PlaywrightTestInfo): string {
  const { titlePath } = testInfo;

  if (!titlePath || titlePath.length === 0) {
    return testInfo.title.toLowerCase().replaceAll(/\s+/g, '-');
  }

  const { folder, fileName } = parseSpecFilePath(titlePath[0]);
  const testName = titlePath.at(-1)!.toLowerCase().replaceAll(/\s+/g, '-');

  return buildSessionPath(folder, fileName, testName);
}

/**
 * Start recording for a test
 * @param testInfo - Playwright test info object
 */
export async function startRecording(
  testInfo: PlaywrightTestInfo,
): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode(Modes.record, sessionId);
}

/**
 * Start replay for a test
 * @param testInfo - Playwright test info object
 */
export async function startReplay(testInfo: PlaywrightTestInfo): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode(Modes.replay, sessionId);
}

/**
 * Stop recording/replay and return to transparent mode
 * @param testInfo - Playwright test info object
 */
export async function stopProxy(testInfo: PlaywrightTestInfo): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode(Modes.transparent, sessionId);
}

/**
 * Playwright test fixture helper for managing proxy mode
 * Use this in beforeEach/afterEach hooks
 */
export const playwrightProxy = {
  /**
   * Setup before test - sets the proxy mode
   * @param testInfo - Playwright test info object
   * @param mode - The proxy mode to use for this test
   */
  async before(testInfo: PlaywrightTestInfo, mode: Mode): Promise<void> {
    const sessionId = generateSessionId(testInfo);
    console.log('Proxy setup:', { mode, sessionId });
    await setProxyMode(mode, sessionId);
  },

  /**
   * Cleanup after test - returns to transparent mode
   * @param testInfo - Playwright test info object
   */
  async after(testInfo: PlaywrightTestInfo): Promise<void> {
    const sessionId = generateSessionId(testInfo);
    await setProxyMode(Modes.transparent, sessionId);
  },
};
