/* eslint-disable sonarjs/todo-tag */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { RecordingSession } from '../types.js';

const JSON_INDENT_SPACES = 2;

export function getRecordingPath(recordingsDir: string, id: string): string {
  // Handle paths with subdirectories (e.g., 'jobs/Create-create-a-job')
  return path.join(recordingsDir, `${id}.mock.json`);
}

export async function loadRecordingSession(
  filePath: string,
): Promise<RecordingSession> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}

export async function saveRecordingSession(
  recordingsDir: string,
  session: RecordingSession,
): Promise<void> {
  const filePath = getRecordingPath(recordingsDir, session.id);

  // Create subdirectories if the session ID contains path separators
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });

  await fs.writeFile(
    filePath,
    JSON.stringify(session, null, JSON_INDENT_SPACES),
  );
  console.log(
    `Saved ${session.recordings.length} HTTP recordings and ${session.websocketRecordings?.length || 0} WebSocket recordings to ${filePath}`,
  );
}
