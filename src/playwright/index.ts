import path from 'node:path';

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

/**
 * Clean up a specific session - removes it from memory and resets counters
 * @param sessionId - The session ID to clean up
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const proxyPort = getProxyPort();

  try {
    const body = {
      cleanup: true,
      id: sessionId,
    };

    const response = await fetch(`http://127.0.0.1:${proxyPort}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to cleanup session ${sessionId}:`, text);
      throw new Error(`Failed to cleanup session: ${text}`);
    }

    await response.json();
    console.log(`Session cleaned up: ${sessionId}`);
  } catch (error) {
    console.error(`Error cleaning up session:`, error);
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

// Cache the recordings directory from the proxy
let cachedRecordingsDir: string | null = null;

/**
 * Get the recordings directory from the proxy server
 */
async function getRecordingsDir(): Promise<string> {
  if (cachedRecordingsDir) {
    return cachedRecordingsDir;
  }

  const proxyPort = getProxyPort();

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/__control`);
    if (response.ok) {
      const data = (await response.json()) as { recordingsDir?: string };
      if (data.recordingsDir) {
        cachedRecordingsDir = data.recordingsDir;
        return cachedRecordingsDir;
      }
    }
  } catch (error) {
    console.warn(
      'Failed to get recordings directory from proxy, using default:',
      error,
    );
  }

  // Fallback to default if proxy is not available
  cachedRecordingsDir = path.join(process.cwd(), 'e2e', 'recordings');
  return cachedRecordingsDir;
}

/**
 * Setup client-side recording/replay using Playwright's routeFromHAR
 */
async function setupClientSideRecording(
  page: Page,
  sessionId: string,
  mode: Mode,
  url: string | RegExp,
): Promise<void> {
  // Generate HAR file path from session ID
  // Convert session path separators to underscores for flat file structure
  const harFileName = sessionId.replaceAll('/', '__');
  const recordingsDir = await getRecordingsDir();
  const harPath = path.join(recordingsDir, `${harFileName}.har`);

  console.log(
    `[Client-Side Recording] Setting up HAR for session: ${sessionId}, mode: ${mode}, path: ${harPath}`,
  );

  try {
    await page.routeFromHAR(harPath, {
      url,
      update: mode === Modes.record,
      updateContent: 'embed',
    });
  } catch (error) {
    if (mode === Modes.replay) {
      console.error(
        `[Client-Side Replay] Failed to load HAR file. Run tests in record mode first.`,
        error,
      );
      throw error;
    }
    // In record mode, if HAR doesn't exist yet, that's ok - it will be created
  }
}

/**
 * Playwright test fixture helper for managing proxy mode
 * Use this in test functions with page.on('close') for automatic cleanup
 */
export interface ClientSideRecordingOptions {
  /**
   * URL pattern for client-side requests to record/replay
   * Uses Playwright's native format (string or RegExp)
   * Example: /cognito-.*amazonaws\.com|\.stream-io-api\.com/
   * Example: 'https://api.example.com/**'
   */
  url?: string | RegExp;
}

export const playwrightProxy = {
  /**
   * Setup before test - sets the proxy mode and configures page with custom header
   * Automatically sets up page.on('close') handler for cleanup
   * @param page - Playwright page object
   * @param testInfo - Playwright test info object
   * @param mode - The proxy mode to use for this test
   * @param options - Optional configuration including timeout and client-side recording patterns
   */
  async before(
    page: Page,
    testInfo: PlaywrightTestInfo,
    mode: Mode,
    options?: number | (ClientSideRecordingOptions & { timeout?: number }),
  ): Promise<void> {
    // Handle backward compatibility - if options is a number, treat it as timeout
    const timeout = typeof options === 'number' ? options : options?.timeout;
    const clientSideOptions =
      typeof options === 'object' && options !== null ? options : undefined;
    const sessionId = generateSessionId(testInfo);

    // Set the custom header on the page for Next.js and other frameworks
    await page.setExtraHTTPHeaders({
      [RECORDING_ID_HEADER]: sessionId,
    });

    // Set the proxy mode FIRST before setting up any route handlers
    console.log(`[Setup] Setting proxy mode: ${mode}, session: ${sessionId}`);
    await setProxyMode(mode, sessionId, timeout);
    console.log(`[Setup] Proxy mode set successfully`);

    // Setup optional client-side recording/replay for 3rd party services BEFORE proxy route handler
    // This is important because Playwright processes routes in REVERSE order of registration
    // We want proxy route handler to run FIRST, so we register it LAST
    if (clientSideOptions?.url) {
      console.log(
        `[Setup] Setting up client-side recording with pattern: ${clientSideOptions.url}`,
      );
      await setupClientSideRecording(
        page,
        sessionId,
        mode,
        clientSideOptions.url,
      );
      console.log(`[Setup] Client-side recording setup complete`);
    }

    // IMPORTANT: Register proxy route handler LAST so it runs FIRST (highest priority)
    // Playwright processes routes in reverse order - last registered = first to run
    // This ensures the recording ID header is added before any other routing logic
    const proxyPort = process.env.TEST_PROXY_RECORDER_PORT || '8100';
    const proxyUrl = `localhost:${proxyPort}`;

    console.log(`[Setup] Registering proxy route handler for: ${proxyUrl}`);
    await page.route(
      (url) => {
        // Match any request to the proxy, regardless of protocol
        const urlStr = url.toString();
        const matches = urlStr.includes(proxyUrl);
        // if (matches) {
        //   console.log(`[Route Matcher] Matched proxy request: ${urlStr}`);
        // }
        return matches;
      },
      async (route) => {
        try {
          // const url = route.request().url();
          // const method = route.request().method();
          const headers = route.request().headers();
          // const hadHeader = !!headers[RECORDING_ID_HEADER];

          // Always set/override the header to ensure it's present
          headers[RECORDING_ID_HEADER] = sessionId;

          // console.log(
          //   `[Route Intercept] ${method} ${url} ` +
          //     `(had header: ${hadHeader}, adding session: ${sessionId})`,
          // );

          // Use continue() to pass the request to the network with modified headers
          await route.continue({ headers });
          // console.log(`[Route Intercept] Request continued successfully`);
        } catch (error) {
          console.error(
            `[Route Handler Error] Failed to add ${RECORDING_ID_HEADER} header:`,
            error,
          );
          // If we can't add the header, fallback to let the request proceed
          await route.fallback();
        }
      },
      { times: Infinity }, // Ensure the handler applies to all matching requests
    );
    console.log(`[Setup] Proxy route handler registered`);

    // Setup cleanup handler for UI mode and manual test runs
    // Use context.on('close') instead of page.on('close') because:
    // - page.on('close') fires during navigation/reload (unreliable)
    // - context.on('close') only fires when browser context closes (reliable)
    // This ensures cleanup happens in UI mode while not interfering with normal test runs
    const context = page.context();

    // Check if we've already registered a handler for this context to avoid duplicates
    const contextId = (context as any)._guid || 'default';
    const handlerKey = `cleanup_${contextId}`;

    if (!(globalThis as any)[handlerKey]) {
      (globalThis as any)[handlerKey] = true;

      context.on('close', async () => {
        try {
          console.log(
            `[Cleanup] Browser context closed, cleaning up session: ${sessionId}`,
          );
          await cleanupSession(sessionId);
        } catch (error) {
          // Ignore errors during cleanup (proxy might already be stopped)
          console.warn(
            `[Cleanup] Failed to cleanup session ${sessionId}:`,
            error,
          );
        } finally {
          // Clear the handler registration
          delete (globalThis as any)[handlerKey];
        }
      });
    }
  },

  /**
   * Global teardown - switches proxy to transparent mode
   * Use this in Playwright's globalTeardown to ensure clean state
   */
  async teardown(): Promise<void> {
    await setProxyMode(Modes.transparent);
  },
};
