import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';

// No `url` option here: the /websocket page makes no client-side HTTP calls,
// WebSocket traffic goes through the proxy and is recorded server-side in .mock.json
test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode as 'record' | 'replay');
});

test('receives welcome message on connect', async ({ page }) => {
  await page.goto('/websocket');

  await expect(page.getByTestId('ws-status')).toHaveText('open');
  // protocol comes from the Sec-WebSocket-Protocol handshake header — proves
  // the proxy forwards it in record mode and answers with it in replay mode
  await expect(page.getByTestId('ws-message').first()).toHaveText(
    'Connected to chat (protocol: chat-v1)',
  );
});

test('sends a message and receives echo reply', async ({ page }) => {
  await page.goto('/websocket');
  await expect(page.getByTestId('ws-status')).toHaveText('open');

  await page.getByTestId('ws-input').fill('hello world');
  await page.getByTestId('ws-send-btn').click();

  await expect(page.getByTestId('ws-message').nth(1)).toContainText('Echo: hello world');
});

test('handles several sequential messages', async ({ page }) => {
  await page.goto('/websocket');
  await expect(page.getByTestId('ws-status')).toHaveText('open');

  for (const msg of ['first', 'second', 'third']) {
    await page.getByTestId('ws-input').fill(msg);
    await page.getByTestId('ws-send-btn').click();
    await expect(page.getByTestId('ws-message').last()).toContainText(`Echo: ${msg}`);
  }

  // welcome + 3 replies
  await expect(page.getByTestId('ws-message')).toHaveCount(4);
});

test('receives high frequency burst of messages', async ({ page }) => {
  await page.goto('/websocket');
  await expect(page.getByTestId('ws-status')).toHaveText('open');

  await page.getByTestId('ws-burst-btn').click();

  // welcome + 20 burst items + burst-end
  await expect(page.getByTestId('ws-message')).toHaveCount(22);
  await expect(page.getByTestId('ws-message').nth(1)).toHaveText('burst 0: item-0');
  await expect(page.getByTestId('ws-message').nth(20)).toHaveText('burst 19: item-19');
  await expect(page.getByTestId('ws-message').nth(21)).toHaveText('burst finished: 20 messages');
});

test('replays message containing a date deterministically', async ({ page }) => {
  // Freeze the browser clock so the client-generated sentAt timestamp is
  // identical in record and replay runs
  await page.clock.setFixedTime(new Date('2030-05-15T10:00:00.000Z'));

  await page.goto('/websocket');
  await expect(page.getByTestId('ws-status')).toHaveText('open');

  await page.getByTestId('ws-input').fill('dated message');
  await page.getByTestId('ws-send-btn').click();

  await expect(page.getByTestId('ws-message').nth(1)).toHaveText(
    'Echo: dated message (sent at 2030-05-15T10:00:00.000Z)',
  );
});
