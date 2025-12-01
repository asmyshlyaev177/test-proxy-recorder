/* eslint-disable sonarjs/todo-tag */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import filenamify from 'filenamify';

import type { Recording, RecordingSession } from '../types.js';

const JSON_INDENT_SPACES = 2;
const EXTENSION = '.mock.json';
// Max filename length: 255 chars on most filesystems
// Reserve space for extension and hash suffix
const MAX_FILENAME_LENGTH = 255 - EXTENSION.length;
const HASH_LENGTH = 8; // Use 8 hex chars for hash suffix (16^8 = 4.3B combinations)

/**
 * Generates a hash from a string to use as a filename suffix
 * @param str The string to hash
 * @returns A hex hash string
 */
function generateHash(str: string): string {
  // Use shake256 which supports outputLength directly
  return crypto
    .createHash('shake256', { outputLength: HASH_LENGTH / 2 }) // outputLength is in bytes, hex is 2 chars per byte
    .update(str)
    .digest('hex');
}

export function getRecordingPath(recordingsDir: string, id: string): string {
  // Sanitize the session ID to create a safe, flat filename
  // Replace path separators with double underscores to preserve structure in the name
  // First, check if we need to truncate before sanitizing
  let processedId = id.replaceAll('/', '__');

  // Check if filename would exceed max length
  if (processedId.length > MAX_FILENAME_LENGTH) {
    // Truncate and append hash to maintain uniqueness
    const hash = generateHash(id);
    const maxBaseLength = MAX_FILENAME_LENGTH - HASH_LENGTH - 1; // -1 for underscore
    processedId = `${processedId.slice(0, maxBaseLength)}_${hash}`;
  }

  // Now sanitize the (possibly truncated) ID
  const sanitizedId = filenamify(processedId, {
    replacement: '_',
    maxLength: 255, // Set explicit max to prevent filenamify's default truncation
  });

  return path.join(recordingsDir, `${sanitizedId}${EXTENSION}`);
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

  await fs.mkdir(recordingsDir, { recursive: true });

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
