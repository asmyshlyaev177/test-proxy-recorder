export { RECORDING_ID_HEADER } from './constants';
export { ProxyServer } from './ProxyServer';
export type {
  ControlRequest,
  Mode,
  Recording,
  RecordingSession,
  WebSocketRecording,
} from './types';

// Playwright integration
export type { PlaywrightTestInfo } from './playwright';
export {
  generateSessionId,
  playwrightProxy,
  setProxyMode,
  startRecording,
  startReplay,
  stopProxy,
} from './playwright';

// Next.js integration
export {
  createHeadersWithRecordingId,
  getRecordingId,
  setNextProxyHeaders,
} from './nextjs';
