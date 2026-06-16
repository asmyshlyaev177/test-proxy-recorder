import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { playwrightProxy } from 'test-proxy-recorder';

export default async function globalTeardown() {
  // Reset the proxy and redact secrets from the `.har` files written during the
  // run before they're committed.
  await playwrightProxy.teardown();

  // The mock backend persists to data/todos.json, and record runs mutate it
  // (create / edit / delete todos). Reset it after the run so the working tree
  // stays clean. `[]` is the backend's empty state.
  await writeFile(path.join(process.cwd(), 'data', 'todos.json'), '[]');
}
