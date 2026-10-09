/* eslint-disable sonarjs/todo-tag */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import filenamify from 'filenamify';

import type { Recording, RecordingSession } from '../types.js';
import { type RedactionConfig, redactSession } from './redact.js';

const JSON_INDENT_SPACES = 2;
const EXTENSION = '.mock.json';
const HAR_EXTENSION = '.har';
// Bytes, not characters: filesystems cap a name at 255 bytes. Well under that,
// so the whole path also fits the 260 characters Git for Windows allows.
const MAX_FILE_BASE_BYTES = 120;
const HASH_LENGTH = 8; // Use 8 hex chars for hash suffix (16^8 = 4.3B combinations)
// Windows reserves these names even with an extension: NUL.txt is NUL.
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com\d|lpt\d)\./i;
// The earlier `.mock.json` cap, in characters, kept to find files saved under it.
const LEGACY_MAX_FILENAME_LENGTH = 255 - EXTENSION.length;

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

function truncateToBytes(text: string, maxBytes: number): string {
  let result = '';
  for (const char of text) {
    if (Buffer.byteLength(result + char) > maxBytes) break;
    result += char;
  }
  return result;
}

/**
 * The name, without extension, of a session's `.mock.json` and `.har` files:
 * one flat name, valid on every platform. Path separators become `__`.
 */
export function getRecordingFileBase(id: string): string {
  const safe = filenamify(id.replaceAll('/', '__'), {
    replacement: '_',
    maxLength: Number.MAX_SAFE_INTEGER,
  });
  const capped =
    Buffer.byteLength(safe) > MAX_FILE_BASE_BYTES
      ? `${truncateToBytes(safe, MAX_FILE_BASE_BYTES - HASH_LENGTH - 1)}_${generateHash(id)}`
      : safe;
  return WINDOWS_DEVICE_NAME.test(capped) ? `_${capped}` : capped;
}

export function getRecordingPath(recordingsDir: string, id: string): string {
  return path.join(recordingsDir, `${getRecordingFileBase(id)}${EXTENSION}`);
}

export function getHarPath(recordingsDir: string, id: string): string {
  return path.join(
    recordingsDir,
    `${getRecordingFileBase(id)}${HAR_EXTENSION}`,
  );
}

/** The `.mock.json` name of earlier versions: a character cap that could pass 255 bytes. */
function getLegacyRecordingPath(recordingsDir: string, id: string): string {
  let processedId = id.replaceAll('/', '__');
  if (processedId.length > LEGACY_MAX_FILENAME_LENGTH) {
    const maxBaseLength = LEGACY_MAX_FILENAME_LENGTH - HASH_LENGTH - 1;
    processedId = `${processedId.slice(0, maxBaseLength)}_${generateHash(id)}`;
  }
  const sanitizedId = filenamify(processedId, {
    replacement: '_',
    maxLength: 255,
  });
  return path.join(recordingsDir, `${sanitizedId}${EXTENSION}`);
}

/** The `.har` name of earlier versions: not sanitized, so `:` or `?` broke it on Windows. */
function getLegacyHarPath(recordingsDir: string, id: string): string {
  return path.join(
    recordingsDir,
    `${id.replaceAll('/', '__')}${HAR_EXTENSION}`,
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

/** The current path, unless only the earlier name exists: replay reads that. */
async function findExistingPath(
  current: string,
  legacy: string,
): Promise<string> {
  if (current === legacy || (await fileExists(current))) return current;
  return (await fileExists(legacy)) ? legacy : current;
}

/** Where to read a session's `.mock.json` from; recording writes {@link getRecordingPath}. */
export function findRecordingPath(
  recordingsDir: string,
  id: string,
): Promise<string> {
  return findExistingPath(
    getRecordingPath(recordingsDir, id),
    getLegacyRecordingPath(recordingsDir, id),
  );
}

/** Where to read a session's `.har` from; recording writes {@link getHarPath}. */
export function findHarPath(
  recordingsDir: string,
  id: string,
): Promise<string> {
  return findExistingPath(
    getHarPath(recordingsDir, id),
    getLegacyHarPath(recordingsDir, id),
  );
}

export async function loadRecordingSession(
  filePath: string,
): Promise<RecordingSession> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  return JSON.parse(fileContent);
}

/**
 * Process recordings to add sequence numbers
 * Sorts recordings by recordingId (request send order) to ensure
 * deterministic replay order that matches the logical test flow
 * @param recordings Raw recordings from proxy
 * @returns Processed recordings with sequence numbers
 */
function processRecordings(recordings: Recording[]): Recording[] {
  // Group recordings by key
  const recordingsByKey = new Map<string, Recording[]>();
  for (const recording of recordings) {
    const key = recording.key;
    if (!recordingsByKey.has(key)) {
      recordingsByKey.set(key, []);
    }
    recordingsByKey.get(key)!.push(recording);
  }

  // Sort each group by recordingId and assign sequences
  const processedRecordings: Recording[] = [];
  for (const [_key, keyRecordings] of recordingsByKey) {
    // Sort by recordingId (order requests were sent)
    // This ensures replay serves responses in the order requests were made,
    // matching the logical test flow (e.g., browser request after POST gets fresh data)
    keyRecordings.sort((a, b) => a.recordingId - b.recordingId);

    // Assign sequence numbers based on sorted order
    for (const [index, recording] of keyRecordings.entries()) {
      processedRecordings.push({ ...recording, sequence: index });
    }
  }

  // Sort by recordingId to maintain overall order in the file
  processedRecordings.sort((a, b) => a.recordingId - b.recordingId);

  return processedRecordings;
}

export async function saveRecordingSession(
  recordingsDir: string,
  session: RecordingSession,
  redaction?: RedactionConfig | false,
): Promise<void> {
  const filePath = getRecordingPath(recordingsDir, session.id);

  await fs.mkdir(recordingsDir, { recursive: true });

  // Process recordings: add sequence numbers and deduplicate
  const processedRecordings = processRecordings(session.recordings);
  // Strip secrets before anything touches disk (no-op unless redaction is on).
  const processedSession = redactSession(
    {
      ...session,
      recordings: processedRecordings,
    },
    redaction,
  );

  await fs.writeFile(
    filePath,
    JSON.stringify(processedSession, null, JSON_INDENT_SPACES),
  );
  console.log(
    `Saved ${processedRecordings.length} HTTP recordings and ${session.websocketRecordings?.length || 0} WebSocket recordings to ${filePath}`,
  );
}
