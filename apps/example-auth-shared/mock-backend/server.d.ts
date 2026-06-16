import type { Server } from 'node:http';

export const TEST_USER: { email: string; password: string };
export const MOCK_ACCESS_TOKEN: string;
export function createMockBackend(opts?: { dataFile?: string }): Server;
