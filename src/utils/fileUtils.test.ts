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

    it('should return path for session ID with subfolder', () => {
      const result = getRecordingPath(
        TEST_RECORDINGS_DIR,
        'jobs/Create-create-a-job',
      );
      expect(result).toBe(
        path.join(TEST_RECORDINGS_DIR, 'jobs/Create-create-a-job.mock.json'),
      );
    });

    it('should return path for session ID with nested subfolders', () => {
      const result = getRecordingPath(
        TEST_RECORDINGS_DIR,
        'users/profile/Update-update-profile',
      );
      expect(result).toBe(
        path.join(
          TEST_RECORDINGS_DIR,
          'users/profile/Update-update-profile.mock.json',
        ),
      );
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

    it('should create subfolder and save session', async () => {
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
            sequence: 0,
          },
        ],
        websocketRecordings: [],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Verify subfolder was created
      const subfolderPath = path.join(TEST_RECORDINGS_DIR, 'jobs');
      const subfolderExists = await fs
        .access(subfolderPath)
        .then(() => true)
        .catch(() => false);
      expect(subfolderExists).toBe(true);

      // Verify file was created
      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'jobs/Create-create-a-job.mock.json',
      );
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const content = await fs.readFile(filePath, 'utf8');
      const savedSession = JSON.parse(content);
      expect(savedSession).toEqual(session);
    });

    it('should create nested subfolders and save session', async () => {
      const session: RecordingSession = {
        id: 'users/profile/Update-update-profile',
        recordings: [],
        websocketRecordings: [],
      };

      await saveRecordingSession(TEST_RECORDINGS_DIR, session);

      // Verify nested subfolders were created
      const nestedPath = path.join(TEST_RECORDINGS_DIR, 'users/profile');
      const nestedExists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false);
      expect(nestedExists).toBe(true);

      // Verify file was created
      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'users/profile/Update-update-profile.mock.json',
      );
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should save session with WebSocket recordings', async () => {
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
        'websocket/Test-ws-test.mock.json',
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

    it('should load session from subfolder', async () => {
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
            sequence: 0,
          },
        ],
        websocketRecordings: [],
      };

      await fs.mkdir(path.join(TEST_RECORDINGS_DIR, 'subfolder'), {
        recursive: true,
      });
      const filePath = path.join(
        TEST_RECORDINGS_DIR,
        'subfolder/Test-load.mock.json',
      );
      await fs.writeFile(filePath, JSON.stringify(session));

      const loadedSession = await loadRecordingSession(filePath);
      expect(loadedSession).toEqual(session);
    });
  });
});
