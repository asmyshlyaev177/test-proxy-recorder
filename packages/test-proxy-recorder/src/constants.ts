export const DEFAULT_TIMEOUT_MS = 120 * 1000;
// One default for the proxy, `reset`, `init` and the Playwright helpers: they
// must agree or the helpers post to a port nothing listens on.
export const DEFAULT_PROXY_PORT = 8100;
export const PROXY_PORT_ENV = 'TEST_PROXY_RECORDER_PORT';
export const HTTP_STATUS_BAD_GATEWAY = 502;
export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_NOT_FOUND = 404;
export const CONTROL_ENDPOINT = '/__control';
// Long-poll a test holds open in replay; answered when a request has no recording.
export const MISSING_RECORDING_ENDPOINT = '/__control/missing-recording';
export const RECORDING_ID_HEADER = 'x-test-rcrd-id';
