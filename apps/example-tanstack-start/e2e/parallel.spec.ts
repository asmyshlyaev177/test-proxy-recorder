import { expect, test } from '@playwright/test';
import { playwrightProxy } from 'test-proxy-recorder';

const mode = process.env.RECORD_MODE ? 'record' : 'replay';

test.beforeEach(async ({ page }, testInfo) => {
  await playwrightProxy.before(page, testInfo, mode);
});

// The page posts four batches of different sizes to one path at once, from the
// server. Replay sends them in the reverse of the recorded order, so a proxy that
// matched them by arrival order would hand each batch a sibling's embeddings.
test('gives each parallel POST to one path its own recorded response', async ({ page }) => {
  await page.goto(mode === 'replay' ? '/parallel?order=reverse' : '/parallel');

  await expect(page.getByTestId('batch-result')).toHaveText([
    'batch-1: 1 sent, 1 received',
    'batch-2: 2 sent, 2 received',
    'batch-3: 3 sent, 3 received',
    'batch-4: 4 sent, 4 received',
  ]);
});
