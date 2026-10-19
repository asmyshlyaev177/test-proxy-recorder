// Same env vars and defaults as the package.json scripts, so a moved port moves here too.
const PROXY_PORT = Number(process.env.TEST_PROXY_RECORDER_PORT || 8100);
// \b keeps port 8100 from also matching 81000.
export const PROXY_URL_PATTERN = new RegExp(`localhost:${PROXY_PORT}\\b`);
export const MOCK_BACKEND_URL = `http://localhost:${process.env.MOCK_BACKEND_PORT || 3102}`;
