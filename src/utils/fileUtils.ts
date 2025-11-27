/* eslint-disable sonarjs/todo-tag */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Recording, RecordingSession } from '../types.js';

const JSON_INDENT_SPACES = 2;
const DEDUP_TIME_WINDOW_MS = 0; // Disable deduplication temporarily for debugging

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

/**
 * Process recordings to add sequence numbers
 * @param recordings Raw recordings from proxy
 * @returns Processed recordings with sequence numbers
 */
function processRecordings(recordings: Recording[]): Recording[] {
  // Track sequence number for each key
  const keySequenceMap = new Map<string, number>();

  // Add sequence numbers to recordings
  return recordings.map((recording) => {
    const key = recording.key;
    const currentSeq = keySequenceMap.get(key) || 0;
    keySequenceMap.set(key, currentSeq + 1);

    return { ...recording, sequence: currentSeq };
  });
}

export async function saveRecordingSession(
  recordingsDir: string,
  session: RecordingSession,
): Promise<void> {
  const filePath = getRecordingPath(recordingsDir, session.id);

  // Create subdirectories if the session ID contains path separators
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });

  // Process recordings: add sequence numbers and deduplicate
  const processedRecordings = processRecordings(session.recordings);
  const processedSession = {
    ...session,
    recordings: processedRecordings,
  };

  await fs.writeFile(
    filePath,
    JSON.stringify(processedSession, null, JSON_INDENT_SPACES),
  );
  console.log(
    `Saved ${processedRecordings.length} HTTP recordings and ${session.websocketRecordings?.length || 0} WebSocket recordings to ${filePath}`,
  );
}
