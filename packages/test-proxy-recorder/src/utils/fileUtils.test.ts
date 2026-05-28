import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RecordingSession } from '../types.js';
import {
  getRecordingPath,
  loadRecordingSession,
  saveRecordingSession,
} from './fileUtils.js';

const TEST_RECORDINGS_DIR = path.join(process.cwd(), 'test-file-utils');

describe('fileUtils', () => {
  beforeEach(async () => {
    // Clean up test directory
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_RECORDINGS_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(TEST_RECORDINGS_DIR, { recursive: true, force: true });
  });

  describe('getRecordingPath', () => {
    it('should return path for simple session ID', () => {
      const result = getRecordingPath(TEST_RECORDINGS_DIR, 'test-session');
      expect(result).toBe(
        path.join(TEST_RECORDINGS_DIR, 'test-session.mock.json'),
      );
    });

    it('should return path for session ID with path separators (flat file)', () => {
      const result = getRecordingPath(
        TEST_RECORDINGS_DIR,
        'jobs/Create-create-a-job',
      );
      expect(result).toBe(
        path.join(TEST_RECORDINGS_DIR, 'jobs__Create-create-a-job.mock.json'),
      );
    });

    it('should return path for session ID with nested path separators (flat file)', () => {
      const result = getRecordingPath(
        TEST_RECORDINGS_DIR,
        'users/profile/Update-update-profile',
      );
      expect(result).toBe(
        path.join(
          TEST_RECORDINGS_DIR,
          'users__profile__Update-update-profile.mock.json',
        ),
      );
    });

    it('should truncate long session IDs and append hash', () => {
      // Create a session ID that's longer than 255 chars
      const longId = 'a'.repeat(300);
      const result = getRecordingPath(TEST_RECORDINGS_DIR, longId);
      const filename = path.basename(result);

      // Should be truncated to max length (255 - extension length = 245)
      expect(filename.length).toBeLessThanOrEqual(255);
      // Should end with .mock.json
      expect(filename).toMatch(/\.mock\.json$/);
      // Should contain a hash suffix (8 hex chars + underscore)
      expect(filename).toMatch(/_[0-9a-f]{8}\.mock\.json$/);
    });

    it('should maintain uniqueness for different long session IDs', () => {
      const longId1 = 'a'.repeat(300) + 'unique1';
      const longId2 = 'a'.repeat(300) + 'unique2';

      const result1 = getRecordingPath(TEST_RECORDINGS_DIR, longId1);
      const result2 = getRecordingPath(TEST_RECORDINGS_DIR, longId2);

      // Different IDs should produce different filenames
      expect(result1).not.toBe(result2);
    });

    it('should sanitize special characters in session ID', () => {
      const idWithSpecialChars = 'test<>:"|?*name';
      const result = getRecordingPath(TEST_RECORDINGS_DIR, idWithSpecialChars);
      const filename = path.basename(result);

      // Special characters should be replaced
      expect(filename).not.toMatch(/[<>:"|?*]/);
      expect(filename).toMatch(/^[a-zA-Z0-9_-]+\.mock\.json$/);
    });
  });

  describe('saveRecordingSession', () => {
    it('should save session to file without subfolder', async () => {
      const session: RecordingSession = {
        id: 'simple-test',
        recordings: [],
        websocketRecordings: [],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      const filePath = path.join(TEST_RECORDINGS_DIR, 'simple-test.mock.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);

      const content = await fs.readFile(filePath, 'utf8');
      const savedSession = JSON.parse(content);
      expect(savedSession).toEqual(session);
    });

    it('should save session with path separators as flat file', async () => {
      const session: RecordingSession = {
        id: 'jobs/Create-create-a-job',
        recordings: [
          {
            request: {
              method: 'POST',
              url: '/api/jobs',
              headers: {},
              body: '{"name":"Test Job"}',
            },
            response: {
              statusCode: 201,
              headers: {},
              body: '{"id":1,"name":"Test Job"}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'POST:/api/jobs',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Verify file was created as flat file (no subfolder)
      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'jobs__Create-create-a-job.mock.json',
      );
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content has sequence numbers added
      const content = await fs.readFile(filePath, 'utf8');
      const savedSession = JSON.parse(content);
      expect(savedSession.id).toBe(session.id);
      expect(savedSession.recordings[0].sequence).toBe(0);
    });

    it('should save session with nested path separators as flat file', async () => {
      const session: RecordingSession = {
        id: 'users/profile/Update-update-profile',
        recordings: [],
        websocketRecordings: [],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Verify file was created as flat file (no nested subfolders)
      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'users__profile__Update-update-profile.mock.json',
      );
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should save session with WebSocket recordings as flat file', async () => {
      const session: RecordingSession = {
        id: 'websocket/Test-ws-test',
        recordings: [],
        websocketRecordings: [
          {
            url: 'ws://localhost:3000/socket',
            messages: [
              {
                direction: 'client-to-server',
                data: 'hello',
                timestamp: '2024-01-01T00:00:00.000Z',
              },
            ],
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'ws://localhost:3000/socket',
          },
        ],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'websocket__Test-ws-test.mock.json',
      );
      const content = await fs.readFile(filePath, 'utf8');
      const savedSession = JSON.parse(content);
      expect(savedSession).toEqual(session);
    });
  });

  describe('loadRecordingSession', () => {
    it('should load session from file', async () => {
      const session: RecordingSession = {
        id: 'load-test',
        recordings: [],
        websocketRecordings: [],
      };

      const filePath = path.join(TEST_RECORDINGS_DIR, 'load-test.mock.json');
      await fs.writeFile(filePath, JSON.stringify(session));

      const loadedSession = await loadRecordingSession(filePath);
      expect(loadedSession).toEqual(session);
    });

    it('should load session from flat file', async () => {
      const session: RecordingSession = {
        id: 'subfolder/Test-load',
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/test',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: {},
              body: '{"success":true}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'GET:/api/test',
            recordingId: 0,
            sequence: 0,
          },
        ],
        websocketRecordings: [],
      };

      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'subfolder__Test-load.mock.json',
      );
      await fs.writeFile(filePath, JSON.stringify(session));

      const loadedSession = await loadRecordingSession(filePath);
      expect(loadedSession).toEqual(session);
    });
  });

  describe('Round-trip save and load', () => {
    it('should save and load session with short ID consistently', async () => {
      const session: RecordingSession = {
        id: 'short-test-id',
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/users',
              headers: { 'content-type': 'application/json' },
              body: null,
            },
            response: {
              statusCode: 200,
              headers: { 'content-type': 'application/json' },
              body: '{"users":[]}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'GET:/api/users',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      // Save the session
      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Load it back
      const filePath = getRecordingPath(TEST_RECORDINGS_DIR, session.id);
      const loadedSession = await loadRecordingSession(filePath);

      // Verify all data is preserved (except sequence is added during save)
      expect(loadedSession.id).toBe(session.id);
      expect(loadedSession.recordings).toHaveLength(1);
      expect(loadedSession.recordings[0].request).toEqual(
        session.recordings[0].request,
      );
      expect(loadedSession.recordings[0].response).toEqual(
        session.recordings[0].response,
      );
      expect(loadedSession.recordings[0].sequence).toBe(0);
    });

    it('should save and load session with long ID consistently', async () => {
      const longId = 'a'.repeat(300) + '_unique_test_id';
      const session: RecordingSession = {
        id: longId,
        recordings: [
          {
            request: {
              method: 'POST',
              url: '/api/data',
              headers: {},
              body: '{"test":"data"}',
            },
            response: {
              statusCode: 201,
              headers: {},
              body: '{"id":1}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'POST:/api/data',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      // Save the session
      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Load it back using the same ID
      const filePath = getRecordingPath(TEST_RECORDINGS_DIR, longId);
      const loadedSession = await loadRecordingSession(filePath);

      // Verify all data is preserved
      expect(loadedSession.id).toBe(longId);
      expect(loadedSession.recordings).toHaveLength(1);
      expect(loadedSession.recordings[0].request).toEqual(
        session.recordings[0].request,
      );
      expect(loadedSession.recordings[0].response).toEqual(
        session.recordings[0].response,
      );
    });

    it('should save and load multiple sessions with similar long IDs', async () => {
      const longId1 = 'a'.repeat(300) + '_session_one';
      const longId2 = 'a'.repeat(300) + '_session_two';

      const session1: RecordingSession = {
        id: longId1,
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/session1',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: {},
              body: '{"session":1}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'GET:/api/session1',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      const session2: RecordingSession = {
        id: longId2,
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/api/session2',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 200,
              headers: {},
              body: '{"session":2}',
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'GET:/api/session2',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      // Save both sessions
      await saveRecordingSession(TEST_RECORDINGS_DIR, session1);
      await saveRecordingSession(TEST_RECORDINGS_DIR, session2);

      // Load them back
      const filePath1 = getRecordingPath(TEST_RECORDINGS_DIR, longId1);
      const filePath2 = getRecordingPath(TEST_RECORDINGS_DIR, longId2);

      const loadedSession1 = await loadRecordingSession(filePath1);
      const loadedSession2 = await loadRecordingSession(filePath2);

      // Verify both sessions are different and contain correct data
      expect(loadedSession1.id).toBe(longId1);
      expect(loadedSession2.id).toBe(longId2);
      expect(loadedSession1.recordings[0].response?.body).toBe('{"session":1}');
      expect(loadedSession2.recordings[0].response?.body).toBe('{"session":2}');

      // Verify the file paths are different
      expect(filePath1).not.toBe(filePath2);
    });

    it('should save and load session with path separators in ID', async () => {
      const session: RecordingSession = {
        id: 'e2e/redirects/redirects__test-name',
        recordings: [
          {
            request: {
              method: 'GET',
              url: '/redirect',
              headers: {},
              body: null,
            },
            response: {
              statusCode: 302,
              headers: { location: '/new-location' },
              body: null,
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            key: 'GET:/redirect',
            recordingId: 0,
          },
        ],
        websocketRecordings: [],
      };

      // Save the session
      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Load it back
      const filePath = getRecordingPath(TEST_RECORDINGS_DIR, session.id);
      const loadedSession = await loadRecordingSession(filePath);

      // Verify the ID and data are preserved
      expect(loadedSession.id).toBe(session.id);
      expect(loadedSession.recordings[0].response?.statusCode).toBe(302);
      expect(loadedSession.recordings[0].response?.headers).toEqual({
        location: '/new-location',
      });
    });
  });
});
