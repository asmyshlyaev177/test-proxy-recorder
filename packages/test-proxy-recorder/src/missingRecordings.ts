import type http from 'node:http';

import { HTTP_STATUS_OK } from './constants.js';

const HTTP_STATUS_NO_CONTENT = 204;

function sendReport(res: http.ServerResponse, message: string): void {
  res.writeHead(HTTP_STATUS_OK, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message }));
}

/** Answers a replaying test's long-poll when one of its requests has no recording. */
export class MissingRecordingNotifier {
  private waiters = new Map<string, Set<http.ServerResponse>>();
  // Kept so a poll that connects after the unrecorded request still gets it.
  private reports = new Map<string, string>();

  wait(sessionId: string, res: http.ServerResponse): void {
    const report = this.reports.get(sessionId);
    if (report !== undefined) {
      sendReport(res, report);
      return;
    }
    const waiting = this.waiters.get(sessionId) ?? new Set();
    waiting.add(res);
    this.waiters.set(sessionId, waiting);
    res.on('close', () => waiting.delete(res));
  }

  report(sessionId: string, message: string): void {
    // The first unrecorded request is the cause; later ones usually follow from it.
    if (this.reports.has(sessionId)) return;
    this.reports.set(sessionId, message);
    for (const res of this.waiters.get(sessionId) ?? [])
      sendReport(res, message);
    this.waiters.delete(sessionId);
  }

  /** A new replay of the session (e.g. a retry) starts clean. */
  reset(sessionId: string): void {
    this.reports.delete(sessionId);
    for (const res of this.waiters.get(sessionId) ?? []) {
      res.writeHead(HTTP_STATUS_NO_CONTENT);
      res.end();
    }
    this.waiters.delete(sessionId);
  }
}
