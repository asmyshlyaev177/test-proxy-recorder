import type { Recording, RecordingSession } from './types.js';

/**
 * State for a single replay session
 * Allows multiple concurrent test runners to replay different recordings simultaneously
 */
export interface ReplaySessionState {
  recordingId: string;
  servedRecordingIdsByKey: Map<string, Set<number>>;
  loadedSession: RecordingSession | null;
  lastAccessTime: number;
  // Cache of sorted recordings per key to avoid re-filtering and re-sorting
  sortedRecordingsByKey: Map<string, Recording[]>;
}

/**
 * Tracks concurrent replay sessions by recording ID and evicts idle ones.
 */
export class ReplaySessionManager {
  private sessions = new Map<string, ReplaySessionState>();
  private evictionTimer: NodeJS.Timeout | null = null;
  private readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  get size(): number {
    return this.sessions.size;
  }

  keys(): IterableIterator<string> {
    return this.sessions.keys();
  }

  /**
   * Get or create a replay session state for a given recording ID
   */
  getOrCreate(recordingId: string): ReplaySessionState {
    let session = this.sessions.get(recordingId);

    if (session) {
      session.lastAccessTime = Date.now();
    } else {
      session = {
        recordingId,
        servedRecordingIdsByKey: new Map(),
        loadedSession: null,
        lastAccessTime: Date.now(),
        sortedRecordingsByKey: new Map(),
      };
      this.sessions.set(recordingId, session);
      this.startEvictionTimer();
      console.log(
        `[CONCURRENT REPLAY] Created new session for recording: ${recordingId}`,
      );
    }

    return session;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);

    if (this.sessions.size === 0) {
      this.stopEvictionTimer();
    }
  }

  private startEvictionTimer(): void {
    if (this.evictionTimer) {
      return;
    }

    // Check every 30 seconds for idle sessions
    const CHECK_INTERVAL_MS = 30_000;

    this.evictionTimer = setInterval(() => {
      const now = Date.now();

      for (const [id, session] of this.sessions) {
        if (now - session.lastAccessTime >= this.timeoutMs) {
          console.log(
            `[EVICTION] Evicting idle replay session: ${id} (idle for ${Math.round((now - session.lastAccessTime) / 1000)}s)`,
          );
          this.sessions.delete(id);
        }
      }

      if (this.sessions.size === 0) {
        this.stopEvictionTimer();
      }
    }, CHECK_INTERVAL_MS);

    // Allow the process to exit even if the timer is running
    this.evictionTimer.unref();
  }

  private stopEvictionTimer(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }
}

/**
 * Get the served-recordings tracker for a key, creating it if needed
 */
export function getServedTracker(
  sessionState: ReplaySessionState,
  key: string,
): Set<number> {
  if (!sessionState.servedRecordingIdsByKey.has(key)) {
    sessionState.servedRecordingIdsByKey.set(key, new Set());
  }
  return sessionState.servedRecordingIdsByKey.get(key)!;
}

/**
 * Recordings for a key sorted by sequence/recordingId, cached per session
 */
export function getSortedRecordings(
  sessionState: ReplaySessionState,
  key: string,
): Recording[] {
  // Return cached sorted recordings if available
  if (sessionState.sortedRecordingsByKey.has(key)) {
    return sessionState.sortedRecordingsByKey.get(key)!;
  }

  // Filter and sort recordings for this key
  const session = sessionState.loadedSession!;
  const sortedRecords = session.recordings
    .filter((r) => r.key === key && r.response)
    .toSorted((a, b) => {
      const aSeq = a.sequence !== undefined ? a.sequence : a.recordingId;
      const bSeq = b.sequence !== undefined ? b.sequence : b.recordingId;
      return aSeq - bSeq;
    });

  // Cache the sorted recordings
  sessionState.sortedRecordingsByKey.set(key, sortedRecords);
  return sortedRecords;
}

/**
 * Pick the recording to serve for a request.
 * Deterministic order: always serve the first unserved recording in the
 * pre-sorted list (sorted by sequence/recordingId). If all are served, reuse
 * the last as a fallback. No time-based or heuristic bias.
 */
export function selectReplayRecord(
  recordsWithKey: Recording[],
  servedForThisKey: Set<number>,
  key: string,
  recordingId: string,
): Recording | null {
  for (const rec of recordsWithKey) {
    if (!servedForThisKey.has(rec.recordingId)) {
      return rec;
    }
  }

  if (recordsWithKey.length > 0) {
    console.log(
      `[REPLAY WARNING] All ${recordsWithKey.length} recordings already served for ${key} (session: ${recordingId}), reusing last one`,
    );
    return recordsWithKey[recordsWithKey.length - 1];
  }

  return null;
}
