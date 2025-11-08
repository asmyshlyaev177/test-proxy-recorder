import type { TestInfo } from '@playwright/test';

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || 'http://localhost:8100';

export type ProxyMode = 'recording' | 'replay' | 'transparent';

export type PlaywrightTestInfo = Pick<TestInfo, 'title'>;

interface ProxyControlRequest {
  mode: ProxyMode;
  id: string;
  timeout?: number;
}

/**
 * Set the proxy mode for a given session
 * @param mode - The proxy mode to set (recording, replay, transparent)
 * @param sessionId - Unique identifier for the session
 * @param timeout - Optional timeout in milliseconds
 */
export async function setProxyMode(
  mode: ProxyMode,
  sessionId: string,
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

/**
 * Generate a session ID from test info
 * @param testInfo - Playwright test info object
 */
export function generateSessionId(testInfo: PlaywrightTestInfo): string {
  return testInfo.title.toLowerCase().replaceAll(/\s+/g, '-');
}

/**
 * Start recording for a test
 * @param testInfo - Playwright test info object
 */
export async function startRecording(
  testInfo: PlaywrightTestInfo,
): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode('recording', sessionId);
}

/**
 * Start replay for a test
 * @param testInfo - Playwright test info object
 */
export async function startReplay(testInfo: PlaywrightTestInfo): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode('replay', sessionId);
}

/**
 * Stop recording/replay and return to transparent mode
 * @param testInfo - Playwright test info object
 */
export async function stopProxy(testInfo: PlaywrightTestInfo): Promise<void> {
  const sessionId = generateSessionId(testInfo);
  await setProxyMode('transparent', sessionId);
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
  async before(testInfo: PlaywrightTestInfo, mode: ProxyMode): Promise<void> {
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
    await setProxyMode('transparent', sessionId);
  },
};
