import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// The mock backend persists to data/todos.json, and record runs mutate it
// (create / edit / delete todos). Reset it after the run so the working tree
// stays clean. `[]` is the backend's empty state.
export default async function globalTeardown() {
  await writeFile(path.join(process.cwd(), 'data', 'todos.json'), '[]');
}
