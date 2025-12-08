import type { Page, TestInfo } from '@playwright/test';

import { RECORDING_ID_HEADER } from '../constants.js';
import { type Mode, Modes } from '../types';

export type PlaywrightTestInfo = Pick<TestInfo, 'title' | 'titlePath'>;

interface ProxyControlRequest {
  mode: Mode;
  id?: string;
  timeout?: number;
}

/**
 * Get the proxy port from environment variable or use default
 * @returns The port number to use
 */
function getProxyPort(): number {
  const envPort = process.env.TEST_PROXY_RECORDER_PORT;
  if (envPort) {
    const parsed = Number.parseInt(envPort, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 8100; // Default fallback
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
  const proxyPort = getProxyPort();

  try {
    const body: ProxyControlRequest = {
      mode,
      id: sessionId,
      ...(timeout && { timeout }),
    };

    const response = await fetch(`http://127.0.0.1:${proxyPort}/__control`, {
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
 * Use this in test functions with page.on('close') for automatic cleanup
 */
export const playwrightProxy = {
  /**
   * Setup before test - sets the proxy mode and configures page with custom header
   * Automatically sets up page.on('close') handler for cleanup
   * @param page - Playwright page object
   * @param testInfo - Playwright test info object
   * @param mode - The proxy mode to use for this test
   * @param timeout - Optional timeout in milliseconds
   */
  async before(
    page: Page,
    testInfo: PlaywrightTestInfo,
    mode: Mode,
    timeout?: number,
  ): Promise<void> {
    const sessionId = generateSessionId(testInfo);

    // Set the custom header on the page for Next.js and other frameworks
    await page.setExtraHTTPHeaders({
      [RECORDING_ID_HEADER]: sessionId,
    });

    // Set the proxy mode
    await setProxyMode(mode, sessionId, timeout);

    // Setup cleanup handler on page close
    page.on('close', async () => {
      try {
        // reset session on cleanup
        await setProxyMode(Modes.replay, sessionId);
        console.log(
          `[Cleanup] Switched to replay mode for session: ${sessionId}`,
        );
      } catch (error) {
        console.error('[Cleanup] Error during page close cleanup:', error);
      }
    });
  },

  /**
   * Global teardown - switches proxy to transparent mode
   * Use this in Playwright's globalTeardown to ensure clean state
   */
  async teardown(): Promise<void> {
    await setProxyMode(Modes.transparent);
  },
};
