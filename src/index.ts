export { ProxyServer } from './ProxyServer';
export type {
  ControlRequest,
  Mode,
  Recording,
  RecordingSession,
  WebSocketRecording,
} from './types';

// Playwright integration
export type { PlaywrightTestInfo, ProxyMode } from './playwright';
export {
  generateSessionId,
  playwrightProxy,
  setProxyMode,
  startRecording,
  startReplay,
  stopProxy,
} from './playwright';
