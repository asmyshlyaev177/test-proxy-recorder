import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

// 'record' hits the real Binance feed and saves it; 'replay' serves the saved
// messages from disk — no network. Set RECORD_MODE=1 to re-record.
const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// The full ordered sequence of BTC-USD prices in this test's committed
// recording, formatted the way the UI renders them. We read it from the
// .mock.json instead of hardcoding, so the assertion stays correct across
// re-records. The filename mirrors the session id Playwright derives from the
// title: `ticker__<kebab-title>.mock.json`.
function recordedPrices(testTitle: string): string[] {
  const slug = testTitle.toLowerCase().replace(/\s+/g, '-');
  const file = path.join('e2e', 'recordings', `ticker__${slug}.mock.json`);
  const session = JSON.parse(fs.readFileSync(file, 'utf8'));
  const messages = session.websocketRecordings[0].messages as {
    direction: string;
    data: string;
  }[];
  return messages
    .filter((m) => m.direction === 'server-to-client')
    .map((m) => {
      try {
        return JSON.parse(m.data).c as string | undefined;
      } catch {
        return undefined;
      }
    })
    .filter((c): c is string => typeof c === 'string')
    .map((c) => `$${Number(c)}`);
}

test('replays the recorded price stream with burst timing', async ({
  page,
}, testInfo) => {
  // Default (burst) timing: recorded messages are served immediately on connect.
  await playwrightProxy.before(page, testInfo, mode);
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('live');

  if (mode !== 'replay') {
    // Recording: let several real updates stream in before the session is saved.
    await expect(page.getByTestId('price')).toHaveText(/^\$\d/);
    await page.waitForTimeout(8000);
    return;
  }

  // Everything arrives at once; assert the ticker shows the final recorded price.
  const expected = recordedPrices(testInfo.title);
  await expect(page.getByTestId('price')).toHaveText(expected.at(-1)!);
});

test('replays the recorded price stream with original timing', async ({
  page,
}, testInfo) => {
  // Original timing: recorded messages are re-paced from their timestamps.
  // Binance pushes ~once per second, so each update is on screen long enough
  // for a native assertion to catch it.
  await playwrightProxy.before(page, testInfo, mode, {
    websocket: { timing: 'original' },
  });
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('live');

  if (mode !== 'replay') {
    await expect(page.getByTestId('price')).toHaveText(/^\$\d/);
    await page.waitForTimeout(8000);
    return;
  }

  // Assert the ticker on every update, in order — one assertion per tick.
  // toHaveText auto-waits for each paced update to land.
  const expected = recordedPrices(testInfo.title);
  for (const price of expected) {
    await expect(page.getByTestId('price')).toHaveText(price);
  }
});
