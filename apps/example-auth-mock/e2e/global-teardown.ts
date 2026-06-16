import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  // Reset the proxy and redact secrets from the `.har` files written during the
  // run before they're committed.
  await playwrightProxy.teardown();

  // Record runs mutate the protected store; reset it so the tree stays clean.
  const dataDir = path.join(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'protected-todos.json'), '[]');
}
