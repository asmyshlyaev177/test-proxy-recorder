import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page, TestInfo } from '@playwright/test';

// Tracks which contexts already have a cleanup handler registered to avoid duplicates.
const registeredContexts = new WeakSet<BrowserContext>();

import {
  DEFAULT_PROXY_PORT,
  MISSING_RECORDING_ENDPOINT,
  PROXY_PORT_ENV,
  RECORDING_ID_HEADER,
} from '../constants.js';
import { type Mode, Modes, type WebSocketReplayConfig } from '../types';
import {
  findHarPath,
  findRecordingPath,
  getHarPath,
} from '../utils/fileUtils.js';
import {
  deserializeRedactionConfig,
  type Har,
  redactHar,
  type RedactionConfig,
  type SerializedRedactionConfig,
} from '../utils/redact.js';

export type PlaywrightTestInfo = Pick<TestInfo, 'title' | 'titlePath'>;

interface ProxyControlRequest {
  mode: Mode;
  id?: string;
  timeout?: number;
  websocket?: WebSocketReplayConfig;
}

/**
 * Get the proxy port from environment variable or use default
 * @returns The port number to use
 */
function getProxyPort(): number {
  const envPort = process.env[PROXY_PORT_ENV];
  if (envPort) {
    const parsed = Number.parseInt(envPort, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return DEFAULT_PROXY_PORT;
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
  websocket?: WebSocketReplayConfig,
): Promise<void> {
  const proxyPort = getProxyPort();

  try {
    const body: ProxyControlRequest = {
      mode,
      id: sessionId,
      ...(timeout && { timeout }),
      ...(websocket && { websocket }),
    };

    const response = await fetch(`http://localhost:${proxyPort}/__control`, {
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

    const response = await fetch(`http://localhost:${proxyPort}/__control`, {
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
  } catch (error) {
    console.error(`Error cleaning up session: ${sessionId}`, error);
    throw error;
  }
}

interface ParsedPath {
  folder: string | null;
  fileName: string | null;
}

/** The old parsing: only `.spec.ts` / `.test.ts` files got a file-name prefix. */
function parseLegacySpecFilePath(specPath: string): ParsedPath {
  const folderMatch = specPath.match(/^(.+?)\/([^/]+)\.(spec|test)\.ts$/);
  if (folderMatch) {
    return { folder: folderMatch[1], fileName: folderMatch[2] };
  }

  const fileMatch = specPath.match(/^([^/]+)\.(spec|test)\.ts$/);
  if (fileMatch) {
    return { folder: null, fileName: fileMatch[1] };
  }

  return { folder: null, fileName: null };
}

const TEST_FILE_SUFFIX = /\.(spec|test)\.[cm]?[jt]sx?$/;
const SCRIPT_EXTENSION = /\.[cm]?[jt]sx?$/;

function parseTestFilePath(filePath: string): ParsedPath {
  const normalized = filePath.replaceAll('\\', '/');
  const slash = normalized.lastIndexOf('/');
  const baseName = normalized.slice(slash + 1);
  const fileName = TEST_FILE_SUFFIX.test(baseName)
    ? baseName.replace(TEST_FILE_SUFFIX, '')
    : baseName.replace(SCRIPT_EXTENSION, '');
  return { folder: slash === -1 ? null : normalized.slice(0, slash), fileName };
}

function slugifyTitle(title: string): string {
  return title.toLowerCase().replaceAll(/\s+/g, '-');
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
 * Session id from the test file, its describe titles and its title:
 * ['jobs/Create.spec.ts', 'admin', 'create a job'] → 'jobs/Create__admin__create-a-job'.
 */
export function generateSessionId(testInfo: PlaywrightTestInfo): string {
  const { titlePath } = testInfo;
  if (!titlePath || titlePath.length === 0) {
    return slugifyTitle(testInfo.title);
  }

  const [first, ...rest] = titlePath;
  const isFirstAFile = SCRIPT_EXTENSION.test(first);
  const titles = isFirstAFile ? rest : titlePath;
  const { folder, fileName } = isFirstAFile
    ? parseTestFilePath(first)
    : { folder: null, fileName: null };

  return buildSessionPath(
    folder,
    fileName,
    titles.map((title) => slugifyTitle(title)).join('__'),
  );
}

/** The old id: last title only, so tests sharing a title in one file collided. */
function generateLegacySessionId(testInfo: PlaywrightTestInfo): string {
  const { titlePath } = testInfo;
  if (!titlePath || titlePath.length === 0) {
    return slugifyTitle(testInfo.title);
  }

  const { folder, fileName } = parseLegacySpecFilePath(titlePath[0]);
  return buildSessionPath(folder, fileName, slugifyTitle(titlePath.at(-1)!));
}

async function hasRecording(sessionId: string): Promise<boolean> {
  const recordingsDir = await getRecordingsDir();
  const files = await Promise.all([
    findRecordingPath(recordingsDir, sessionId),
    findHarPath(recordingsDir, sessionId),
  ]);
  const found = await Promise.all(
    files.map((file) =>
      fs.access(file).then(
        () => true,
        () => false,
      ),
    ),
  );
  return found.includes(true);
}

/**
 * Replay keeps working for recordings made before describe titles were part of
 * the id: the old name is used only while no recording exists under the new one.
 */
async function resolveReplaySessionId(
  testInfo: PlaywrightTestInfo,
): Promise<string> {
  const sessionId = generateSessionId(testInfo);
  const legacyId = generateLegacySessionId(testInfo);
  if (legacyId === sessionId || (await hasRecording(sessionId))) {
    return sessionId;
  }
  return (await hasRecording(legacyId)) ? legacyId : sessionId;
}

async function resolveSessionId(
  testInfo: PlaywrightTestInfo,
  mode: Mode,
): Promise<string> {
  return mode === Modes.replay
    ? resolveReplaySessionId(testInfo)
    : generateSessionId(testInfo);
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
  const sessionId = await resolveReplaySessionId(testInfo);
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
    const response = await fetch(`http://localhost:${proxyPort}/__control`);
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

// Cache the proxy's redaction config (fetched once from /__control).
let cachedRedaction: RedactionConfig | undefined;
let redactionFetched = false;

/**
 * Reset the cached `/__control` lookups. Test-only — not re-exported from the
 * package entry, so it stays out of the public API.
 * @internal
 */
export function __resetProxyCachesForTests(): void {
  cachedRecordingsDir = null;
  cachedRedaction = undefined;
  redactionFetched = false;
}

/**
 * Get the redaction config the proxy was started with, so HAR redaction matches
 * the `.mock.json` redaction. Returns `undefined` if the proxy is unreachable or
 * has no config (in which case the built-in defaults still apply).
 */
async function getRedactionConfig(): Promise<RedactionConfig | undefined> {
  if (redactionFetched) {
    return cachedRedaction;
  }
  redactionFetched = true;

  const proxyPort = getProxyPort();
  try {
    const response = await fetch(`http://localhost:${proxyPort}/__control`);
    if (response.ok) {
      const data = (await response.json()) as {
        redaction?: SerializedRedactionConfig | false;
      };
      cachedRedaction = deserializeRedactionConfig(data.redaction);
    }
  } catch {
    // Proxy unreachable — fall back to built-in defaults.
  }
  return cachedRedaction;
}

/**
 * Strip secrets from one `.har` file using the proxy's redaction config.
 * Rewrites the file only when redaction actually changed something, so HARs with
 * nothing to redact (e.g. ordinary recordings) keep Playwright's exact bytes and
 * don't show up as spurious diffs. Best-effort: failures are logged, not thrown.
 */
async function redactHarFile(
  harPath: string,
  redaction: RedactionConfig | undefined,
): Promise<void> {
  try {
    const content = await fs.readFile(harPath, 'utf8');
    const parsed = JSON.parse(content) as Har;
    const redacted = redactHar(parsed, redaction);
    // Compact compare: redactHar preserves key order and only changes values,
    // so unequal output means a secret was scrubbed.
    if (JSON.stringify(parsed) === JSON.stringify(redacted)) {
      return;
    }
    await fs.writeFile(harPath, `${JSON.stringify(redacted, null, 2)}\n`);
  } catch (error) {
    console.warn(`[HAR Redaction] Failed to redact ${harPath}:`, error);
  }
}

/**
 * Redact every `.har` file in the proxy's recordings directory. Called from
 * `playwrightProxy.teardown()` once Playwright has flushed all HARs. A no-op
 * when redaction is disabled (config `false`/omitted) or the proxy is
 * unreachable for its config.
 */
async function redactHarRecordings(): Promise<void> {
  const redaction = await getRedactionConfig();
  // Opt-in: only scrub HARs when the proxy reports a redaction config.
  if (!redaction) {
    return;
  }

  const dir = await getRecordingsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    // No recordings directory yet — nothing to redact.
    return;
  }

  await Promise.all(
    entries
      .filter((name) => name.endsWith('.har'))
      .map((name) => redactHarFile(path.join(dir, name), redaction)),
  );
}

/**
 * Setup client-side recording/replay using Playwright's routeFromHAR
 */
/** The HAR a session records to, or replays from (an older name when only it exists). */
async function harPathForSession(
  sessionId: string,
  mode: Mode,
): Promise<string> {
  const recordingsDir = await getRecordingsDir();
  return mode === Modes.record
    ? getHarPath(recordingsDir, sessionId)
    : findHarPath(recordingsDir, sessionId);
}

async function setupClientSideRecording(
  page: Page,
  sessionId: string,
  mode: Mode,
  url: string | RegExp,
): Promise<void> {
  const harPath = await harPathForSession(sessionId, mode);

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
  url?: string | RegExp | undefined;
  /**
   * Per-test WebSocket replay pacing. Overrides the proxy-level setting for this
   * session only — e.g. `{ timing: 'original' }` to re-pace recorded messages
   * from their timestamps. Applies in replay mode.
   */
  websocket?: WebSocketReplayConfig | undefined;
}

interface BeforeOptions extends ClientSideRecordingOptions {
  timeout?: number | undefined;
  /**
   * Replay only: close the page, failing the test, as soon as the proxy gets a
   * request this test never recorded. Defaults to true.
   */
  failOnMissingRecording?: boolean | undefined;
}

const NAVIGATION_SETTLE_MS = 3000;

/** Tracks whether the main frame has a navigation that has not reached `load`. */
function trackPendingNavigation(page: Page): () => boolean {
  let isNavigating = false;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      isNavigating = true;
    }
  });
  page.on('load', () => {
    isNavigating = false;
  });
  page.on('requestfailed', (request) => {
    if (request.isNavigationRequest()) isNavigating = false;
  });
  return () => isNavigating;
}

/** Closes the page with the proxy's reason once it reports an unrecorded request. */
function watchMissingRecordings(page: Page, sessionId: string): void {
  const controller = new AbortController();
  page.once('close', () => controller.abort());
  const isNavigating = trackPendingNavigation(page);
  const url = `http://localhost:${getProxyPort()}${MISSING_RECORDING_ENDPOINT}?id=${encodeURIComponent(sessionId)}`;

  // Any other outcome (aborted on close, proxy gone, older proxy) just stops watching.
  fetch(url, { signal: controller.signal })
    .then(async (response) => {
      if (response.status !== 200) return;
      const { message } = (await response.json()) as { message: string };
      const reason = `[test-proxy-recorder] ${message}. Re-record this test, or pass failOnMissingRecording: false to playwrightProxy.before() to allow it.`;
      console.error(reason);
      // Closing mid-navigation fails page.goto() with a bare net::ERR_ABORTED
      // that drops the reason, so let a pending navigation finish first.
      if (isNavigating()) {
        await page
          .waitForEvent('load', { timeout: NAVIGATION_SETTLE_MS })
          .catch(() => {});
      }
      await page.close({ reason });
    })
    .catch(() => {});
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
    options?: number | BeforeOptions,
  ): Promise<void> {
    // Handle backward compatibility - if options is a number, treat it as timeout
    const timeout = typeof options === 'number' ? options : options?.timeout;
    const clientSideOptions =
      typeof options === 'object' && options !== null ? options : undefined;
    const sessionId = await resolveSessionId(testInfo, mode);

    // Set the custom header on the page for Next.js and other frameworks
    await page.setExtraHTTPHeaders({
      [RECORDING_ID_HEADER]: sessionId,
    });

    // Also set the fallback cookie on the proxy origin. Browser WebSocket
    // handshakes cannot be intercepted by page.route(), and setExtraHTTPHeaders
    // does not propagate to the upgrade request (verified on Chromium), so the
    // recording-id header never reaches the proxy for a WS connection. The
    // handshake does send same-origin cookies, so the proxy reads
    // proxy-recording-id as the session id for concurrent WS replay.
    const fallbackProxyPort = getProxyPort();
    await page.context().addCookies([
      {
        name: 'proxy-recording-id',
        value: encodeURIComponent(sessionId),
        url: `http://localhost:${fallbackProxyPort}`,
      },
    ]);

    // Set the proxy mode FIRST before setting up any route handlers
    await setProxyMode(mode, sessionId, timeout, clientSideOptions?.websocket);

    if (
      mode === Modes.replay &&
      clientSideOptions?.failOnMissingRecording !== false
    ) {
      watchMissingRecordings(page, sessionId);
    }

    // Setup optional client-side recording/replay for 3rd party services BEFORE proxy route handler
    // This is important because Playwright processes routes in REVERSE order of registration
    // We want proxy route handler to run FIRST, so we register it LAST
    if (clientSideOptions?.url) {
      await setupClientSideRecording(
        page,
        sessionId,
        mode,
        clientSideOptions.url,
      );
    }

    // IMPORTANT: Register proxy route handler LAST so it runs FIRST (highest priority)
    // Playwright processes routes in reverse order - last registered = first to run
    // This ensures the recording ID header is added before any other routing logic
    const proxyUrl = `localhost:${getProxyPort()}`;

    await page.route(
      (url) => {
        // Match any request to the proxy, regardless of protocol
        const urlStr = url.toString();
        const matches = urlStr.includes(proxyUrl);
        return matches;
      },
      async (route) => {
        try {
          const headers = route.request().headers();

          // Always set/override the header to ensure it's present
          headers[RECORDING_ID_HEADER] = sessionId;

          // Use continue() to pass the request to the network with modified headers
          await route.continue({ headers });
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

    // Setup cleanup handler for UI mode and manual test runs
    // Use context.on('close') instead of page.on('close') because:
    // - page.on('close') fires during navigation/reload (unreliable)
    // - context.on('close')  only fires when browser context closes (reliable)
    // This ensures cleanup happens in UI mode while not interfering with normal test runs
    const context = page.context();

    if (!registeredContexts.has(context)) {
      registeredContexts.add(context);

      context.on('close', async () => {
        try {
          await cleanupSession(sessionId);
        } catch (error) {
          // Ignore errors during cleanup (proxy might already be stopped)
          console.warn(
            `[Cleanup] Failed to cleanup session ${sessionId}:`,
            error,
          );
        } finally {
          registeredContexts.delete(context);
        }
      });
    }
  },

  /**
   * Global teardown — switches the proxy to transparent mode and redacts the
   * `.har` files Playwright wrote during the run.
   *
   * HAR redaction happens here, not per-test, on purpose: Playwright flushes a
   * HAR when its context closes but does not await `context.on('close')`
   * listeners, so redacting there races the process exit and can truncate the
   * file. `globalTeardown` runs once, after every context has flushed, and IS
   * awaited — so it's the only reliable place to scrub HARs.
   */
  async teardown(): Promise<void> {
    await redactHarRecordings();
    await setProxyMode(Modes.transparent);
  },
};
