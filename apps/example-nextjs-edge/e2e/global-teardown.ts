import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  // Return the proxy to transparent mode after the run.
  await playwrightProxy.teardown();

  // Record runs mutate the shared mock store; reset it so the tree stays clean.
  // Ensure the data dir exists first — a replay-only run never writes to the
  // mock backend, so on a fresh checkout (data/ is gitignored) it won't exist.
  const dataDir = path.join(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'todos.json'), '[]');
}
