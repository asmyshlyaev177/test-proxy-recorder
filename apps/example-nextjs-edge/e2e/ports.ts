// Defaults match the package.json scripts; the mock backend moves with MOCK_BACKEND_PORT.
export const MOCK_BACKEND_URL = `http://localhost:${process.env.MOCK_BACKEND_PORT || 3012}`;
