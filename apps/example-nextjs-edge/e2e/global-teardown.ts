import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  // Return the proxy to transparent mode after the run.
  await playwrightProxy.teardown();

  // Record runs mutate the shared mock store; reset it so the tree stays clean.
  await writeFile(path.join(process.cwd(), 'data', 'todos.json'), '[]');
}
