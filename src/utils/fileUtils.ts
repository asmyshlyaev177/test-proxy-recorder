/* eslint-disable sonarjs/todo-tag */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { RecordingSession } from '../types.js';

const JSON_INDENT_SPACES = 2;

// TODO: use testInfo.titlePath ? e.g. titlePath: [ 'jobs/Create.spec.ts', 'create a job' ],
// TODO: change mode back to transparent on test fail ?
// TODO: set mode transparent afterAll
// TODO: add some delay on after step, to wait for all requests?
export function getRecordingPath(recordingsDir: string, id: string): string {
  return path.join(recordingsDir, `${id}.json`);
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
  await fs.writeFile(
    filePath,
    JSON.stringify(session, null, JSON_INDENT_SPACES),
  );
  console.log(
    `Saved ${session.recordings.length} HTTP recordings and ${session.websocketRecordings?.length || 0} WebSocket recordings to ${filePath}`,
  );
}
